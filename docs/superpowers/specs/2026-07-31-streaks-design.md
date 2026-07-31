# Phase 3 — Streaks on Recurring Tasks

**Status:** approved 2026-07-31
**Plan reference:** `plans/goal_tracker_plan.md` §7 Build Order, Phase 3
**Depends on:** Phase 1 (Goals/Categories/Subgoals) and Phase 2 (Task Manager), both shipped.

## Goal

Recurring tasks currently carry a boolean flag and nothing else. This phase gives them a
completion history, derives current and longest streaks from it, and surfaces both on the
Task Manager screen and in Settings.

## Decisions

| Question | Decision |
|---|---|
| How is a recurring completion recorded? | A `task_completions` log, one row per day completed. Streaks are derived, never stored. |
| What cadences exist? | `daily`, `weekdays` (Mon–Fri), `weekly`. Per-task column. |
| What does a streak count? | Consecutive expected *occurrences* satisfied, not calendar days. |
| What does the grace period mean? | Days late. An occurrence is satisfied by a completion within `grace` days after its expected day. |
| Where does a weekly task's anchor weekday come from? | The weekday of the task's `created_at`. No extra column, no extra form field. |
| Is the grace period configurable? | Yes — a settings column, 0–7 days, default 2, with the stepper from the mockup. |
| Which screens ship this phase? | Task Manager and Settings. The Dashboard widget waits for Phase 7 and reuses the same components. |
| How do recurring tasks behave on the board? | Their column is derived from the log: Done if today's occurrence is satisfied, otherwise To do. |
| Do recurring tasks count toward goal progress? | No. A habit has no end state to be a fraction of. |

## 1. Schema — migration 2

`is_recurring` is replaced by `recurrence` rather than joined by it. Keeping both would permit
the invalid state `is_recurring = 1, recurrence IS NULL`; with one column, "recurring" simply
means "has a recurrence".

```sql
ALTER TABLE tasks ADD COLUMN recurrence TEXT
  CHECK (recurrence IS NULL OR recurrence IN ('daily','weekdays','weekly'));
UPDATE tasks SET recurrence = 'daily' WHERE is_recurring = 1;
ALTER TABLE tasks DROP COLUMN is_recurring;

CREATE TABLE task_completions (
    id           INTEGER PRIMARY KEY,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    completed_on TEXT    NOT NULL,          -- local calendar date, 'YYYY-MM-DD'
    created_at   TEXT    NOT NULL,          -- UTC RFC 3339, matching repo::now()
    UNIQUE (task_id, completed_on)
);
CREATE INDEX idx_completions_task ON task_completions(task_id, completed_on);

ALTER TABLE settings ADD COLUMN streak_grace_days INTEGER NOT NULL DEFAULT 2
  CHECK (streak_grace_days BETWEEN 0 AND 7);
```

Migration 1 is already shipped and is not edited; this is appended to `MIGRATIONS` as entry 2.

### Local dates, not UTC

`repo::now()` stays UTC RFC 3339 for `created_at` / `updated_at` timestamps. Streak dates are
different: "today" is `chrono::Local::now().date_naive()`, so a habit checked off at 11pm belongs
to that evening's day rather than tomorrow's UTC date. `completed_on` therefore holds a local
calendar date and is never parsed as an instant.

### Blast radius of the column swap

`models.rs`, `repo/task.rs`, `src/lib/api/types.ts`, `src/lib/api/index.ts`,
`src/lib/components/TaskDrawer.svelte`, `src/routes/tasks/+page.svelte`.

## 2. Streak math — `src-tauri/src/streak.rs`

Pure functions with no database access, mirroring how `progress.rs` isolates the progress rule.
This module holds all the risk in the phase, so it is kept independently testable.

```rust
pub fn expected_days(rec: Recurrence, anchor: Weekday, from: NaiveDate, to: NaiveDate)
    -> Vec<NaiveDate>;

pub fn summarize(expected: &[NaiveDate], done: &HashSet<NaiveDate>, grace: i64, today: NaiveDate)
    -> Streak;

pub struct Streak { pub current: i64, pub longest: i64 }
```

**History window.** Occurrences start at the task's `created_at` local date. Days before the task
existed are not misses.

**Occurrence classification.** For an expected day `d`:

- **Satisfied** — a completion row exists in `[d, d + grace]`.
- **Pending** — not satisfied, but `d + grace >= today`, so the window is still open.
- **Missed** — not satisfied and the window has closed.

**Counters.**

- `current` — consecutive Satisfied occurrences walking backwards from the most recent expected
  day, skipping trailing Pending ones. An untouched task today does not zero yesterday's streak;
  it zeroes only once today's grace window shuts.
- `longest` — the longest run of consecutive Satisfied occurrences across the whole history.

**Consequence to keep in mind.** With grace 2, a single completion satisfies up to three daily
occurrences. That is the plan's "missing up to 2 days doesn't reset the streak" stated from the
other direction, not a bug.

**Anchors.** `weekly` expects one occurrence per week on the weekday of `created_at`. `weekdays`
expects Mon–Fri. `daily` expects every day. Re-anchoring a weekly task means recreating it; the
drawer shows the anchor read-only so it is not a mystery.

## 3. Backend surface

New `repo/completion.rs` — insert or delete a `(task_id, completed_on)` row, and fetch a task's
completion dates within a range. New `repo/streak.rs` — assemble a task, the settings grace value
and the completion log into a card.

| Command | Returns |
|---|---|
| `list_streaks(days)` | `Vec<StreakCard>` |
| `set_task_completion(id, date: Option<String>, done: bool)` | `StreakCard` |
| `set_streak_grace_days(days)` | `Settings` |

```rust
struct StreakCard { task: Task, current: i64, longest: i64, done_today: bool, cells: Vec<DayCell> }
struct DayCell { date: String, state: CellState }
enum  CellState { Done, Missed, Pending, NotExpected }
```

The backend classifies each cell so the heatmap is dumb rendering and all four states are
unit-testable. `days` is the number of trailing calendar days of cells to return, ending today; the
Task Manager passes 20 to match the mockup's strip. `list_streaks` returns one card per recurring
task — every task with a non-null `recurrence`, in the same order `list_tasks` uses — and an empty
vector when there are none.

`set_task_completion` with `date: None` means today's local date — the frontend never decides what
"today" is. Calling it on a non-recurring task is a `validation` error.

`list_tasks` changes its return type from `Vec<Task>` to `Vec<TaskSummary>`, where `TaskSummary` is
a `Task` plus `completed_today: bool`, resolved with one `LEFT JOIN` against today's completions
rather than a query per task. `completed_today` is always `false` for non-recurring tasks.

## 4. Progress rule change

`progress.rs` stays pure and unchanged. The filtering happens where children are gathered, in
`repo/goal.rs` and `repo/subgoal.rs`: recurring tasks are dropped before averaging. A goal whose
only children are habits reports zero children and therefore 0.0 progress, identical to a goal with
no children at all.

Existing progress tests continue to pass unmodified; new tests cover the exclusion.

## 5. Frontend

**Components.** `StreakCard.svelte` and `StreakHeatmap.svelte`, built standalone with no route
coupling so the Phase 7 dashboard widget reuses them unchanged.

**`/tasks`.** A streak card grid above the board, two columns, per the mockup. Cards for recurring
tasks on the board show a done-today toggle in place of the status pill, and their column is
derived — `completedToday ? Done : To do` — so the board resets itself at midnight with no cron job
or startup task.

**`TaskDrawer`.** The recurring checkbox becomes a recurrence `Select` (None / Daily / Weekdays /
Weekly). When Weekly is selected, a read-only line reads `Repeats weekly · Tuesdays`.

**`/settings`.** A grace period stepper, 0–7 days, matching the mockup's design.

**API layer.** `types.ts` gains `Recurrence`, `StreakCard`, `DayCell`, `CellState`, `TaskSummary`,
and `Settings.streakGraceDays`; `Task.isRecurring` is replaced by `Task.recurrence`. `index.ts`
gains `listStreaks`, `setTaskCompletion`, and `setStreakGraceDays`.

## 6. Testing

The streak math carries the risk, so it takes the bulk of the coverage.

- **Rust unit tests, `streak.rs`** — grace boundaries at exactly `grace` and `grace + 1` days late;
  weekly anchor selection; Pending versus Missed at the edge of the window; `longest` spanning a
  gap; empty history; grace of 0.
- **Rust repo tests** — completion insert/delete idempotence, the `UNIQUE` constraint, cascade on
  task delete, `set_task_completion` rejecting a non-recurring task, and goal progress excluding
  recurring tasks.
- **Migration tests** — migration 2 backfills `is_recurring = 1` rows to `daily` and is a no-op on
  a second run.
- **Playwright** — the new Settings stepper and the Tasks streak section, at the shell level.

E2E still cannot exercise CRUD, because the plain web build has no Tauri backend
(`plans/playwright-test-plan.md`). That limitation is unchanged by this phase.

## Out of scope

- The Dashboard streak widget (Phase 7).
- Editing a weekly task's anchor weekday after creation.
- Backfilling or editing past completions from the UI.
- Per-task grace overrides — the grace period stays global.
