# Phase 3 Streaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give recurring tasks a completion history, derive current/longest streaks and a heatmap from it, and surface both on the Task Manager and Settings screens.

**Architecture:** A `task_completions` log is the single source of truth; streaks are always derived, never stored. Streak math lives in a pure Rust module (`streak.rs`) with no database access, mirroring how `progress.rs` isolates the progress rule. The backend classifies every heatmap cell so the frontend only renders.

**Tech Stack:** Rust + rusqlite + chrono (backend), SvelteKit 5 runes + Tailwind 4 (frontend), Tauri 2 IPC between them. Tests: `cargo test` for Rust, Vitest for pure TS helpers, Playwright for the app shell.

**Spec:** `docs/superpowers/specs/2026-07-31-streaks-design.md`

## Global Constraints

- Work in `app/`. All `npm` commands run from `app/`; all `cargo` commands use `--manifest-path src-tauri/Cargo.toml` (or run from `app/src-tauri`).
- Cadence values are exactly `daily`, `weekdays`, `weekly`. Grace period is an integer 0–7, default 2.
- `completed_on` holds a **local** calendar date as `YYYY-MM-DD`. Never derive it from a UTC instant. `repo::now()` stays UTC RFC 3339 and is used only for `created_at`/`updated_at`.
- Migrations are append-only: never edit `M0001_INITIAL`. New entries are appended to `MIGRATIONS` and `PRAGMA user_version` tracks how many ran.
- Enums that cross both SQLite and serde use the existing `sql_enum!` macro in `models.rs` — never hand-roll a second pattern.
- Rust structs serialize `#[serde(rename_all = "camelCase")]`; TypeScript types in `src/lib/api/types.ts` must mirror them exactly.
- Colors come from theme tokens (`text-accent`, `bg-surface`, `border-subtle`, …). Never a raw hex value in a component.
- The whole gate is `npm test` (Vitest + `cargo test` + Playwright). Individual tasks run narrower commands; Task 9 runs the full gate.

---

### Task 1: Migration 2 — recurrence column, completion log, grace column

Replaces the `is_recurring` boolean with a `recurrence` cadence column, adds the completion log table, and adds the grace-period setting. `is_recurring` is dropped rather than kept alongside `recurrence`, because keeping both would permit the invalid state `is_recurring = 1, recurrence IS NULL`.

**Files:**
- Modify: `app/src-tauri/src/db/migrations.rs` (append `M0002_STREAKS`, add tests)
- Modify: `app/src-tauri/src/models.rs` (add `Recurrence`, change `Task`/`TaskInput`/`TaskUpdate`)
- Modify: `app/src-tauri/src/repo/task.rs` (columns, insert, update, test fixtures)
- Modify: `app/src-tauri/src/repo/goal.rs` (test fixture at `add_task`)
- Modify: `app/src-tauri/src/repo/subgoal.rs` (two test fixtures using `is_recurring`)

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `models::Recurrence` — `Daily | Weekdays | Weekly`, with `as_str()` and `parse()` from `sql_enum!`.
  - `models::Task.recurrence: Option<Recurrence>` (replaces `is_recurring: bool`).
  - `models::Task::is_recurring(&self) -> bool` and `Task::counts_toward_progress(&self) -> bool`.
  - `TaskInput.recurrence: Option<Recurrence>`, `TaskUpdate.recurrence: Option<Recurrence>`.
  - Tables `task_completions(id, task_id, completed_on, created_at)` and column `settings.streak_grace_days`.

- [ ] **Step 1: Write the failing migration tests**

Add to the `tests` module at the bottom of `app/src-tauri/src/db/migrations.rs`:

```rust
    #[test]
    fn migration_two_backfills_recurring_tasks_to_daily() {
        // Start at schema version 1 so the upgrade path itself is exercised,
        // not just the end state a fresh database lands on.
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(MIGRATIONS[0]).unwrap();
        conn.pragma_update(None, "user_version", 1i64).unwrap();
        conn.execute(
            "INSERT INTO tasks (title, is_recurring, created_at, updated_at)
             VALUES ('Stretch', 1, datetime('now'), datetime('now'))",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO tasks (title, is_recurring, created_at, updated_at)
             VALUES ('Buy a notebook', 0, datetime('now'), datetime('now'))",
            [],
        )
        .unwrap();

        run(&mut conn).unwrap();

        let mut stmt = conn
            .prepare("SELECT title, recurrence FROM tasks ORDER BY id")
            .unwrap();
        let rows: Vec<(String, Option<String>)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();

        assert_eq!(
            rows,
            vec![
                ("Stretch".to_string(), Some("daily".to_string())),
                ("Buy a notebook".to_string(), None),
            ]
        );
    }

    #[test]
    fn migration_two_drops_the_old_recurring_flag() {
        let conn = db::open_in_memory().unwrap();
        let err = conn
            .query_row("SELECT is_recurring FROM tasks", [], |row| row.get::<_, i64>(0))
            .unwrap_err();

        assert!(
            err.to_string().contains("is_recurring"),
            "expected the dropped column to be unknown, got: {err}"
        );
    }

    #[test]
    fn completions_are_unique_per_task_and_day_and_cascade() {
        let conn = db::open_in_memory().unwrap();
        conn.execute(
            "INSERT INTO tasks (id, title, recurrence, created_at, updated_at)
             VALUES (1, 'Stretch', 'daily', datetime('now'), datetime('now'))",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO task_completions (task_id, completed_on, created_at)
             VALUES (1, '2026-07-30', datetime('now'))",
            [],
        )
        .unwrap();

        let duplicate = conn.execute(
            "INSERT INTO task_completions (task_id, completed_on, created_at)
             VALUES (1, '2026-07-30', datetime('now'))",
            [],
        );
        assert!(duplicate.is_err(), "the same day must not be logged twice");

        conn.execute("DELETE FROM tasks WHERE id = 1", []).unwrap();
        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM task_completions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(remaining, 0, "completions must cascade with their task");
    }

    #[test]
    fn the_grace_period_defaults_to_two_days() {
        let conn = db::open_in_memory().unwrap();
        let grace: i64 = conn
            .query_row("SELECT streak_grace_days FROM settings WHERE id = 1", [], |row| {
                row.get(0)
            })
            .unwrap();

        assert_eq!(grace, 2);
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml migrations`
Expected: FAIL — `no such column: recurrence`, `no such table: task_completions`, and `migration_two_drops_the_old_recurring_flag` fails because `is_recurring` still exists.

- [ ] **Step 3: Append migration 2**

In `app/src-tauri/src/db/migrations.rs`, change the `MIGRATIONS` constant and add the new migration below `M0001_INITIAL`:

```rust
const MIGRATIONS: &[&str] = &[M0001_INITIAL, M0002_STREAKS];
```

```rust
const M0002_STREAKS: &str = r#"
-- One cadence column replaces the boolean: "recurring" now means "has a recurrence",
-- so `is_recurring = 1, recurrence IS NULL` cannot be represented at all.
ALTER TABLE tasks ADD COLUMN recurrence TEXT
    CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekdays', 'weekly'));

UPDATE tasks SET recurrence = 'daily' WHERE is_recurring = 1;

ALTER TABLE tasks DROP COLUMN is_recurring;

-- `completed_on` is a LOCAL calendar date, never a UTC instant: a habit checked
-- off at 11pm belongs to that evening, not to tomorrow in UTC.
CREATE TABLE task_completions (
    id           INTEGER PRIMARY KEY,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    completed_on TEXT    NOT NULL,
    created_at   TEXT    NOT NULL,
    UNIQUE (task_id, completed_on)
);

CREATE INDEX idx_completions_task ON task_completions(task_id, completed_on);

ALTER TABLE settings ADD COLUMN streak_grace_days INTEGER NOT NULL DEFAULT 2
    CHECK (streak_grace_days BETWEEN 0 AND 7);
"#;
```

- [ ] **Step 4: Add the `Recurrence` enum and reshape `Task`**

In `app/src-tauri/src/models.rs`, add below the `TaskStatus` block:

```rust
sql_enum!(Recurrence {
    Daily => "daily",
    Weekdays => "weekdays",
    Weekly => "weekly",
});
```

Change the `Task`, `TaskInput` and `TaskUpdate` structs — replace each `pub is_recurring: bool` line with the recurrence field:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub status: TaskStatus,
    pub due_date: Option<String>,
    pub goal_id: Option<i64>,
    pub subgoal_id: Option<i64>,
    /// `None` means a one-off task. Anything else makes it a habit with a streak.
    pub recurrence: Option<Recurrence>,
    pub created_at: String,
    pub updated_at: String,
}

impl Task {
    pub fn is_recurring(&self) -> bool {
        self.recurrence.is_some()
    }

    /// A habit has no end state, so it is not a fraction of anything its parent
    /// goal can be "done" with — it is left out of the progress average entirely.
    pub fn counts_toward_progress(&self) -> bool {
        self.recurrence.is_none()
    }
}
```

```rust
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub title: String,
    pub due_date: Option<String>,
    pub goal_id: Option<i64>,
    pub subgoal_id: Option<i64>,
    #[serde(default)]
    pub recurrence: Option<Recurrence>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskUpdate {
    pub title: String,
    pub status: TaskStatus,
    pub due_date: Option<String>,
    pub goal_id: Option<i64>,
    pub subgoal_id: Option<i64>,
    #[serde(default)]
    pub recurrence: Option<Recurrence>,
}
```

- [ ] **Step 5: Update the task repository**

In `app/src-tauri/src/repo/task.rs`:

Change the import line to bring in `Recurrence`:

```rust
use crate::models::{Recurrence, Task, TaskInput, TaskStatus, TaskUpdate};
```

Change `COLUMNS` and `map`:

```rust
const COLUMNS: &str =
    "id, title, status, due_date, goal_id, subgoal_id, recurrence, created_at, updated_at";
```

```rust
fn map(row: &Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get("id")?,
        title: row.get("title")?,
        status: row.get("status")?,
        due_date: row.get("due_date")?,
        goal_id: row.get("goal_id")?,
        subgoal_id: row.get("subgoal_id")?,
        recurrence: row.get("recurrence")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}
```

In `create`, change the INSERT column list and its bound value:

```rust
    conn.execute(
        "INSERT INTO tasks (title, status, due_date, goal_id, subgoal_id, recurrence, created_at, updated_at)
         VALUES (?1, 'todo', ?2, ?3, ?4, ?5, ?6, ?6)",
        params![
            title,
            optional_text(input.due_date),
            goal_id,
            subgoal_id,
            input.recurrence,
            timestamp
        ],
    )?;
```

In `update`, change the SET clause and its bound value:

```rust
    let changed = conn.execute(
        "UPDATE tasks
         SET title = ?1, status = ?2, due_date = ?3, goal_id = ?4, subgoal_id = ?5,
             recurrence = ?6, updated_at = ?7
         WHERE id = ?8",
        params![
            title,
            input.status,
            optional_text(input.due_date),
            goal_id,
            subgoal_id,
            input.recurrence,
            now(),
            id
        ],
    )?;
```

In the `tests` module of the same file, change the `task_input` helper:

```rust
    fn task_input(title: &str) -> TaskInput {
        TaskInput {
            title: title.into(),
            due_date: None,
            goal_id: None,
            subgoal_id: None,
            recurrence: None,
        }
    }
```

Then add a test for the new field, next to `creates_an_unlinked_task_as_todo`:

```rust
    #[test]
    fn a_cadence_makes_a_task_recurring() {
        let conn = db::open_in_memory().unwrap();

        let one_off = create(&conn, task_input("Buy a notebook")).unwrap();
        let habit = create(
            &conn,
            TaskInput {
                recurrence: Some(Recurrence::Weekdays),
                ..task_input("Stretch")
            },
        )
        .unwrap();

        assert!(!one_off.is_recurring());
        assert!(habit.is_recurring());
        assert_eq!(get(&conn, habit.id).unwrap().recurrence, Some(Recurrence::Weekdays));
    }
```

- [ ] **Step 6: Fix the remaining test fixtures**

Three fixtures in other repo modules still set `is_recurring`. In `app/src-tauri/src/repo/goal.rs`, inside `mod tests`, change the `add_task` helper's `TaskInput` literal so `is_recurring: false,` becomes `recurrence: None,`.

In `app/src-tauri/src/repo/subgoal.rs`, inside `mod tests`, make the same substitution in both `TaskInput` literals — the one in `subgoal_with_tasks_averages_them` and the one in `deleting_a_subgoal_leaves_its_tasks_on_the_goal`.

- [ ] **Step 7: Run the full Rust suite**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS — all pre-existing tests plus the five new ones.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/db/migrations.rs src-tauri/src/models.rs src-tauri/src/repo/task.rs src-tauri/src/repo/goal.rs src-tauri/src/repo/subgoal.rs
git commit -m "feat: add recurrence cadence, completion log and grace period schema"
```

---

### Task 2: Streak math

The pure core of the phase: expected occurrences, per-occurrence classification, and the two counters. No database, no `Local::now()` — `today` is always a parameter, so every case is directly testable.

**Files:**
- Create: `app/src-tauri/src/streak.rs`
- Modify: `app/src-tauri/src/lib.rs` (declare the module)
- Modify: `app/src-tauri/src/models.rs` (add `CellState`)

**Interfaces:**
- Consumes: `models::Recurrence` (Task 1).
- Produces:
  - `models::CellState` — `Done | Missed | Pending | NotExpected`, serialized snake_case.
  - `streak::Streak { current: i64, longest: i64 }`.
  - `streak::expected_days(rec: Recurrence, anchor: Weekday, from: NaiveDate, to: NaiveDate) -> Vec<NaiveDate>`.
  - `streak::state_of(day: NaiveDate, done: &HashSet<NaiveDate>, grace: i64, today: NaiveDate) -> CellState`.
  - `streak::summarize(expected: &[NaiveDate], done: &HashSet<NaiveDate>, grace: i64, today: NaiveDate) -> Streak`.

- [ ] **Step 1: Write the failing tests**

Create `app/src-tauri/src/streak.rs` containing only the test module for now:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn date(text: &str) -> NaiveDate {
        NaiveDate::parse_from_str(text, "%Y-%m-%d").unwrap()
    }

    fn done(days: &[&str]) -> HashSet<NaiveDate> {
        days.iter().map(|day| date(day)).collect()
    }

    // 2026-07-27 is a Monday, so this week runs Mon 27th to Sun 2026-08-02.

    #[test]
    fn daily_expects_every_day_in_the_range() {
        let days = expected_days(Recurrence::Daily, Weekday::Mon, date("2026-07-27"), date("2026-07-30"));

        assert_eq!(days.len(), 4);
        assert_eq!(days[0], date("2026-07-27"));
        assert_eq!(days[3], date("2026-07-30"));
    }

    #[test]
    fn weekdays_skips_the_weekend() {
        let days = expected_days(Recurrence::Weekdays, Weekday::Mon, date("2026-07-27"), date("2026-08-02"));

        assert_eq!(days.len(), 5);
        assert_eq!(days.last(), Some(&date("2026-07-31")));
    }

    #[test]
    fn weekly_expects_only_its_anchor_weekday() {
        let days = expected_days(Recurrence::Weekly, Weekday::Tue, date("2026-07-27"), date("2026-08-11"));

        assert_eq!(days, vec![date("2026-07-28"), date("2026-08-04"), date("2026-08-11")]);
    }

    #[test]
    fn an_occurrence_completed_within_grace_still_counts() {
        let log = done(&["2026-07-30"]);
        let today = date("2026-07-31");

        // Grace 2: the 28th's window is [28, 30], so the completion on the 30th covers it.
        assert_eq!(state_of(date("2026-07-28"), &log, 2, today), CellState::Done);
        // Grace 1: the window is [28, 29] and closed before the completion landed.
        assert_eq!(state_of(date("2026-07-28"), &log, 1, today), CellState::Missed);
    }

    #[test]
    fn an_open_window_is_pending_not_missed() {
        let log = HashSet::new();
        let today = date("2026-07-31");

        // Today's own window is always still open.
        assert_eq!(state_of(today, &log, 2, today), CellState::Pending);
        // Grace 2 keeps the 29th open through the 31st...
        assert_eq!(state_of(date("2026-07-29"), &log, 2, today), CellState::Pending);
        // ...but the 28th's window shut yesterday.
        assert_eq!(state_of(date("2026-07-28"), &log, 2, today), CellState::Missed);
    }

    #[test]
    fn grace_zero_demands_the_exact_day() {
        let log = done(&["2026-07-30"]);
        let today = date("2026-07-31");

        assert_eq!(state_of(date("2026-07-30"), &log, 0, today), CellState::Done);
        assert_eq!(state_of(date("2026-07-29"), &log, 0, today), CellState::Missed);
    }

    #[test]
    fn a_pending_day_does_not_end_the_current_streak() {
        let today = date("2026-07-31");
        let expected = expected_days(Recurrence::Daily, Weekday::Mon, date("2026-07-28"), today);
        // Done through the 30th, nothing logged for today yet.
        let log = done(&["2026-07-28", "2026-07-29", "2026-07-30"]);

        let streak = summarize(&expected, &log, 0, today);

        assert_eq!(streak.current, 3, "today is still pending, not a break");
        assert_eq!(streak.longest, 3);
    }

    #[test]
    fn a_closed_miss_resets_current_but_not_longest() {
        let today = date("2026-07-31");
        let expected = expected_days(Recurrence::Daily, Weekday::Mon, date("2026-07-20"), today);
        // A four-day run, a hard gap, then two more days.
        let log = done(&[
            "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23",
            "2026-07-29", "2026-07-30",
        ]);

        let streak = summarize(&expected, &log, 0, today);

        assert_eq!(streak.current, 2);
        assert_eq!(streak.longest, 4);
    }

    #[test]
    fn an_empty_history_has_no_streak() {
        let today = date("2026-07-31");
        let streak = summarize(&[], &HashSet::new(), 2, today);

        assert_eq!((streak.current, streak.longest), (0, 0));
    }

    #[test]
    fn a_weekly_habit_counts_weeks_not_days() {
        let today = date("2026-08-11");
        let expected = expected_days(Recurrence::Weekly, Weekday::Tue, date("2026-07-28"), today);
        let log = done(&["2026-07-28", "2026-08-04"]);

        let streak = summarize(&expected, &log, 2, today);

        assert_eq!(streak.current, 2, "two Tuesdays running");
        assert_eq!(streak.longest, 2);
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml streak`
Expected: FAIL to compile — `file not found for module streak` (the module is not declared yet), then unresolved `expected_days` / `state_of` / `summarize`.

- [ ] **Step 3: Add `CellState` to the models**

In `app/src-tauri/src/models.rs`, add after the `Recurrence` enum:

```rust
/// How one calendar day reads on a streak heatmap.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CellState {
    /// The occurrence was satisfied — on the day itself or within the grace window.
    Done,
    /// The window closed with nothing logged.
    Missed,
    /// Nothing logged yet, but the window is still open.
    Pending,
    /// The cadence does not expect this day at all.
    NotExpected,
}
```

- [ ] **Step 4: Implement the streak module**

Write the implementation at the top of `app/src-tauri/src/streak.rs`, above the existing `mod tests`:

```rust
//! The streak rule, kept as pure functions so every case is unit testable without
//! a database or a real clock — `today` is always passed in.
//!
//! A streak counts consecutive *occurrences* the cadence expected, not calendar
//! days: a weekly habit done three weeks running has a streak of 3, not 21.

use std::collections::HashSet;

use chrono::{Datelike, Duration, NaiveDate, Weekday};

use crate::models::{CellState, Recurrence};

pub struct Streak {
    pub current: i64,
    pub longest: i64,
}

/// Every day in `from..=to` that the cadence expects an occurrence on.
/// `anchor` only matters for `Weekly`; the other cadences ignore it.
pub fn expected_days(
    rec: Recurrence,
    anchor: Weekday,
    from: NaiveDate,
    to: NaiveDate,
) -> Vec<NaiveDate> {
    let mut days = Vec::new();
    let mut day = from;

    while day <= to {
        let expected = match rec {
            Recurrence::Daily => true,
            Recurrence::Weekdays => !matches!(day.weekday(), Weekday::Sat | Weekday::Sun),
            Recurrence::Weekly => day.weekday() == anchor,
        };
        if expected {
            days.push(day);
        }
        day += Duration::days(1);
    }

    days
}

/// An occurrence is satisfied by a completion on its own day or up to `grace`
/// days later. Until that window closes it is Pending rather than Missed, so an
/// untouched task today never zeroes yesterday's streak.
pub fn state_of(
    day: NaiveDate,
    done: &HashSet<NaiveDate>,
    grace: i64,
    today: NaiveDate,
) -> CellState {
    let satisfied = (0..=grace).any(|offset| done.contains(&(day + Duration::days(offset))));

    if satisfied {
        CellState::Done
    } else if day + Duration::days(grace) >= today {
        CellState::Pending
    } else {
        CellState::Missed
    }
}

/// `current` walks back from the newest occurrence, skipping ones whose window is
/// still open. `longest` is the best run anywhere in the history.
pub fn summarize(
    expected: &[NaiveDate],
    done: &HashSet<NaiveDate>,
    grace: i64,
    today: NaiveDate,
) -> Streak {
    let states: Vec<CellState> = expected
        .iter()
        .map(|&day| state_of(day, done, grace, today))
        .collect();

    let mut longest = 0;
    let mut run = 0;
    for state in &states {
        match state {
            CellState::Done => {
                run += 1;
                longest = longest.max(run);
            }
            CellState::Missed => run = 0,
            // A still-open window neither extends nor breaks a run.
            _ => {}
        }
    }

    let mut current = 0;
    for state in states.iter().rev() {
        match state {
            CellState::Pending => continue,
            CellState::Done => current += 1,
            _ => break,
        }
    }

    Streak { current, longest }
}
```

- [ ] **Step 5: Declare the module**

In `app/src-tauri/src/lib.rs`, add `mod streak;` to the module list so it reads:

```rust
#[macro_use]
mod commands;
mod db;
mod error;
mod models;
mod progress;
mod repo;
mod streak;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml streak`
Expected: PASS — 10 tests.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/streak.rs src-tauri/src/lib.rs src-tauri/src/models.rs
git commit -m "feat: add pure streak math for recurring task cadences"
```

---

### Task 3: Completion log and streak card assembly

Wires the pure math to the database: a repository for the log, a repository that assembles cards, and the progress-rule change that drops habits from goal averages.

**Files:**
- Create: `app/src-tauri/src/repo/completion.rs`
- Create: `app/src-tauri/src/repo/streak.rs`
- Modify: `app/src-tauri/src/repo/mod.rs` (declare modules, add `today()` and `local_date_of()`)
- Modify: `app/src-tauri/src/models.rs` (add `DayCell`, `StreakCard`, `TaskSummary`)
- Modify: `app/src-tauri/src/repo/task.rs` (`list` returns `Vec<TaskSummary>`, add `list_recurring`)
- Modify: `app/src-tauri/src/repo/goal.rs` (exclude habits from progress)
- Modify: `app/src-tauri/src/repo/subgoal.rs` (exclude habits from progress)

**Interfaces:**
- Consumes: `streak::{expected_days, state_of, summarize, Streak}` and `models::{CellState, Recurrence, Task}` (Tasks 1–2).
- Produces:
  - `repo::today() -> NaiveDate` (local) and `repo::local_date_of(rfc3339: &str) -> Result<NaiveDate>`.
  - `models::DayCell { date: String, state: CellState }`.
  - `models::StreakCard { task: Task, current: i64, longest: i64, done_today: bool, cells: Vec<DayCell> }`.
  - `models::TaskSummary { task: Task (flattened), completed_today: bool }`.
  - `repo::completion::set(conn, task_id, on: NaiveDate, done: bool) -> Result<()>`.
  - `repo::completion::dates_for_task(conn, task_id, from, to) -> Result<HashSet<NaiveDate>>`.
  - `repo::streak::card(conn, task_id, days: i64) -> Result<StreakCard>`.
  - `repo::streak::list(conn, days: i64) -> Result<Vec<StreakCard>>`.
  - `repo::streak::set_completion(conn, task_id, on: Option<NaiveDate>, done: bool, days: i64) -> Result<StreakCard>`.
  - `repo::streak::DEFAULT_CELL_DAYS: i64 = 20`.

- [ ] **Step 1: Write the failing tests**

Create `app/src-tauri/src/repo/streak.rs` with only its test module for now:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::models::{GoalInput, Recurrence, TaskInput, Timeframe};
    use crate::repo::{completion, goal, task};

    fn habit(conn: &Connection, title: &str, recurrence: Recurrence) -> i64 {
        task::create(
            conn,
            TaskInput {
                title: title.into(),
                due_date: None,
                goal_id: None,
                subgoal_id: None,
                recurrence: Some(recurrence),
            },
        )
        .unwrap()
        .id
    }

    #[test]
    fn a_fresh_habit_has_an_empty_streak() {
        let conn = db::open_in_memory().unwrap();
        let id = habit(&conn, "Stretch", Recurrence::Daily);

        let card = card(&conn, id, 20).unwrap();

        assert_eq!((card.current, card.longest), (0, 0));
        assert!(!card.done_today);
        assert_eq!(card.cells.len(), 20);
    }

    #[test]
    fn checking_off_today_starts_a_streak() {
        let conn = db::open_in_memory().unwrap();
        let id = habit(&conn, "Stretch", Recurrence::Daily);

        let card = set_completion(&conn, id, None, true, 20).unwrap();

        assert_eq!(card.current, 1);
        assert!(card.done_today);
        assert_eq!(card.cells.last().unwrap().state, CellState::Done);
    }

    #[test]
    fn unchecking_removes_the_completion() {
        let conn = db::open_in_memory().unwrap();
        let id = habit(&conn, "Stretch", Recurrence::Daily);
        set_completion(&conn, id, None, true, 20).unwrap();

        let card = set_completion(&conn, id, None, false, 20).unwrap();

        assert_eq!(card.current, 0);
        assert!(!card.done_today);
    }

    #[test]
    fn checking_off_twice_is_idempotent() {
        let conn = db::open_in_memory().unwrap();
        let id = habit(&conn, "Stretch", Recurrence::Daily);

        set_completion(&conn, id, None, true, 20).unwrap();
        let card = set_completion(&conn, id, None, true, 20).unwrap();

        assert_eq!(card.current, 1);
        let logged: i64 = conn
            .query_row("SELECT COUNT(*) FROM task_completions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(logged, 1);
    }

    #[test]
    fn days_before_the_task_existed_are_not_misses() {
        let conn = db::open_in_memory().unwrap();
        let id = habit(&conn, "Stretch", Recurrence::Daily);

        let card = card(&conn, id, 20).unwrap();

        // The task was created today, so every earlier cell is outside its history.
        let not_expected = card
            .cells
            .iter()
            .filter(|cell| cell.state == CellState::NotExpected)
            .count();
        assert_eq!(not_expected, 19);
    }

    #[test]
    fn only_recurring_tasks_have_streaks() {
        let conn = db::open_in_memory().unwrap();
        let one_off = task::create(
            &conn,
            TaskInput {
                title: "Buy a notebook".into(),
                due_date: None,
                goal_id: None,
                subgoal_id: None,
                recurrence: None,
            },
        )
        .unwrap()
        .id;

        assert_eq!(card(&conn, one_off, 20).unwrap_err().kind(), "validation");
        assert_eq!(
            set_completion(&conn, one_off, None, true, 20).unwrap_err().kind(),
            "validation"
        );
        assert_eq!(list(&conn, 20).unwrap().len(), 0);
    }

    #[test]
    fn listing_covers_every_habit() {
        let conn = db::open_in_memory().unwrap();
        habit(&conn, "Stretch", Recurrence::Daily);
        habit(&conn, "Review the week", Recurrence::Weekly);

        let titles: Vec<String> = list(&conn, 20)
            .unwrap()
            .into_iter()
            .map(|card| card.task.title)
            .collect();

        assert_eq!(titles.len(), 2);
        assert!(titles.contains(&"Stretch".to_string()));
    }

    #[test]
    fn the_grace_setting_changes_the_answer() {
        let conn = db::open_in_memory().unwrap();
        let id = habit(&conn, "Stretch", Recurrence::Daily);
        let today = crate::repo::today();
        // Backdate the habit so it has three days of history, and log only the oldest.
        conn.execute(
            "UPDATE tasks SET created_at = ?1 WHERE id = ?2",
            rusqlite::params![
                (today - chrono::Duration::days(2))
                    .and_hms_opt(9, 0, 0)
                    .unwrap()
                    .and_utc()
                    .to_rfc3339(),
                id
            ],
        )
        .unwrap();
        completion::set(&conn, id, today - chrono::Duration::days(2), true).unwrap();

        conn.execute("UPDATE settings SET streak_grace_days = 0 WHERE id = 1", [])
            .unwrap();
        assert_eq!(card(&conn, id, 20).unwrap().current, 0, "grace 0 breaks on the gap");

        conn.execute("UPDATE settings SET streak_grace_days = 7 WHERE id = 1", [])
            .unwrap();
        assert_eq!(card(&conn, id, 20).unwrap().current, 1, "grace 7 keeps it alive");
    }

    #[test]
    fn habits_are_left_out_of_goal_progress() {
        let conn = db::open_in_memory().unwrap();
        let goal_id = goal::create(
            &conn,
            GoalInput {
                category_id: None,
                title: "Get fit".into(),
                description: None,
                timeframe: Timeframe::Mid,
                due_date: None,
                motivation_text: None,
                motivation_image_path: None,
            },
        )
        .unwrap()
        .id;

        // One ordinary task, done, plus a habit that should not dilute the average.
        let ordinary = task::create(
            &conn,
            TaskInput {
                title: "Buy shoes".into(),
                due_date: None,
                goal_id: Some(goal_id),
                subgoal_id: None,
                recurrence: None,
            },
        )
        .unwrap()
        .id;
        task::set_status(&conn, ordinary, crate::models::TaskStatus::Done).unwrap();
        task::create(
            &conn,
            TaskInput {
                title: "Stretch".into(),
                due_date: None,
                goal_id: Some(goal_id),
                subgoal_id: None,
                recurrence: Some(Recurrence::Daily),
            },
        )
        .unwrap();

        assert_eq!(goal::get_detail(&conn, goal_id).unwrap().progress, 1.0);
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml repo::streak`
Expected: FAIL to compile — `file not found for module streak` under `repo`, then unresolved `card`, `list`, `set_completion`.

- [ ] **Step 3: Add the local-date helpers**

In `app/src-tauri/src/repo/mod.rs`, add `completion` and `streak` to the module list and add the two helpers below `now()`:

```rust
pub mod category;
pub mod completion;
pub mod goal;
pub mod settings;
pub mod streak;
pub mod subgoal;
pub mod task;

use chrono::{DateTime, Local, NaiveDate, SecondsFormat, Utc};
```

```rust
/// Streaks are reckoned in local calendar days: a habit checked off at 11pm
/// belongs to that evening, not to tomorrow in UTC.
pub fn today() -> NaiveDate {
    Local::now().date_naive()
}

/// The local calendar day a stored RFC 3339 timestamp fell on.
pub fn local_date_of(timestamp: &str) -> Result<NaiveDate> {
    DateTime::parse_from_rfc3339(timestamp)
        .map(|moment| moment.with_timezone(&Local).date_naive())
        .map_err(|err| Error::Validation(format!("unreadable timestamp {timestamp}: {err}")))
}
```

- [ ] **Step 4: Add the serialized streak types**

In `app/src-tauri/src/models.rs`, add below `GoalDetail`:

```rust
/// One square on a streak heatmap. The backend decides the state so the frontend
/// only paints.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayCell {
    /// Local calendar date, `YYYY-MM-DD`.
    pub date: String,
    pub state: CellState,
}

/// Everything the streak card on the Task Manager needs for one habit.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreakCard {
    pub task: Task,
    pub current: i64,
    pub longest: i64,
    pub done_today: bool,
    pub cells: Vec<DayCell>,
}

/// A task as the board shows it: the record plus whether today is already logged.
/// Always `false` for a one-off task, which has no daily state to be in.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskSummary {
    #[serde(flatten)]
    pub task: Task,
    pub completed_today: bool,
}
```

- [ ] **Step 5: Implement the completion repository**

Create `app/src-tauri/src/repo/completion.rs`:

```rust
//! The completion log — one row per day a recurring task was done. This is the
//! source of truth; streak counters are always derived from it, never stored.

use std::collections::HashSet;

use chrono::NaiveDate;
use rusqlite::{params, Connection};

use super::now;
use crate::error::Result;

/// SQLite has no date type; `completed_on` is stored in this format so plain
/// string comparison sorts and ranges correctly.
pub const DATE_FORMAT: &str = "%Y-%m-%d";

pub fn format(date: NaiveDate) -> String {
    date.format(DATE_FORMAT).to_string()
}

/// Logs or unlogs one day. Logging a day twice is a no-op rather than an error —
/// the UI toggle should be safe to double-click.
pub fn set(conn: &Connection, task_id: i64, on: NaiveDate, done: bool) -> Result<()> {
    if done {
        conn.execute(
            "INSERT INTO task_completions (task_id, completed_on, created_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT (task_id, completed_on) DO NOTHING",
            params![task_id, format(on), now()],
        )?;
    } else {
        conn.execute(
            "DELETE FROM task_completions WHERE task_id = ?1 AND completed_on = ?2",
            params![task_id, format(on)],
        )?;
    }

    Ok(())
}

pub fn dates_for_task(
    conn: &Connection,
    task_id: i64,
    from: NaiveDate,
    to: NaiveDate,
) -> Result<HashSet<NaiveDate>> {
    let mut stmt = conn.prepare(
        "SELECT completed_on FROM task_completions
         WHERE task_id = ?1 AND completed_on BETWEEN ?2 AND ?3",
    )?;

    let dates = stmt
        .query_map(params![task_id, format(from), format(to)], |row| {
            row.get::<_, String>(0)
        })?
        .collect::<rusqlite::Result<Vec<String>>>()?
        .into_iter()
        .filter_map(|text| NaiveDate::parse_from_str(&text, DATE_FORMAT).ok())
        .collect();

    Ok(dates)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn seed_habit(conn: &Connection) -> i64 {
        conn.execute(
            "INSERT INTO tasks (title, recurrence, created_at, updated_at)
             VALUES ('Stretch', 'daily', datetime('now'), datetime('now'))",
            [],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    #[test]
    fn logging_the_same_day_twice_keeps_one_row() {
        let conn = db::open_in_memory().unwrap();
        let task_id = seed_habit(&conn);
        let day = NaiveDate::from_ymd_opt(2026, 7, 30).unwrap();

        set(&conn, task_id, day, true).unwrap();
        set(&conn, task_id, day, true).unwrap();

        assert_eq!(dates_for_task(&conn, task_id, day, day).unwrap().len(), 1);
    }

    #[test]
    fn unlogging_a_day_that_was_never_logged_is_harmless() {
        let conn = db::open_in_memory().unwrap();
        let task_id = seed_habit(&conn);
        let day = NaiveDate::from_ymd_opt(2026, 7, 30).unwrap();

        set(&conn, task_id, day, false).unwrap();

        assert!(dates_for_task(&conn, task_id, day, day).unwrap().is_empty());
    }

    #[test]
    fn the_range_is_inclusive_at_both_ends() {
        let conn = db::open_in_memory().unwrap();
        let task_id = seed_habit(&conn);
        for day in 28..=31 {
            set(&conn, task_id, NaiveDate::from_ymd_opt(2026, 7, day).unwrap(), true).unwrap();
        }

        let found = dates_for_task(
            &conn,
            task_id,
            NaiveDate::from_ymd_opt(2026, 7, 29).unwrap(),
            NaiveDate::from_ymd_opt(2026, 7, 30).unwrap(),
        )
        .unwrap();

        assert_eq!(found.len(), 2);
        assert!(found.contains(&NaiveDate::from_ymd_opt(2026, 7, 29).unwrap()));
    }
}
```

- [ ] **Step 6: Implement the streak repository**

Write the implementation at the top of `app/src-tauri/src/repo/streak.rs`, above the `mod tests` block from Step 1:

```rust
//! Assembles a streak card: task + grace setting + completion log, run through
//! the pure math in `crate::streak`.

use chrono::{Datelike, Duration, NaiveDate};
use rusqlite::Connection;

use super::{completion, local_date_of, task, today};
use crate::error::{Error, Result};
use crate::models::{CellState, DayCell, StreakCard, Task};
use crate::streak;

/// How many trailing days the Task Manager's heatmap strip shows.
pub const DEFAULT_CELL_DAYS: i64 = 20;

pub fn card(conn: &Connection, task_id: i64, days: i64) -> Result<StreakCard> {
    build(conn, task::get(conn, task_id)?, days)
}

/// One card per habit, in the same order `task::list` uses.
pub fn list(conn: &Connection, days: i64) -> Result<Vec<StreakCard>> {
    task::list_recurring(conn)?
        .into_iter()
        .map(|habit| build(conn, habit, days))
        .collect()
}

/// `on = None` means today. Returns the recomputed card so the caller never has
/// to make a second round trip to see the new streak.
pub fn set_completion(
    conn: &Connection,
    task_id: i64,
    on: Option<NaiveDate>,
    done: bool,
    days: i64,
) -> Result<StreakCard> {
    let habit = task::get(conn, task_id)?;
    ensure_recurring(&habit)?;

    completion::set(conn, task_id, on.unwrap_or_else(today), done)?;
    build(conn, habit, days)
}

fn ensure_recurring(habit: &Task) -> Result<()> {
    if habit.is_recurring() {
        Ok(())
    } else {
        Err(Error::Validation(format!(
            "task {} is not recurring, so it has no streak",
            habit.id
        )))
    }
}

fn build(conn: &Connection, habit: Task, days: i64) -> Result<StreakCard> {
    let recurrence = match habit.recurrence {
        Some(recurrence) => recurrence,
        None => {
            ensure_recurring(&habit)?;
            unreachable!("ensure_recurring rejects a task with no recurrence")
        }
    };

    let today = today();
    // History starts the day the habit was created: days before it existed are
    // not misses. A weekly habit's anchor is that same day's weekday.
    let start = local_date_of(&habit.created_at)?.min(today);
    let anchor = start.weekday();
    let grace = super::settings::grace_days(conn)?;

    let done = completion::dates_for_task(conn, habit.id, start, today)?;
    let expected = streak::expected_days(recurrence, anchor, start, today);
    let summary = streak::summarize(&expected, &done, grace, today);

    let expected_set: std::collections::HashSet<NaiveDate> = expected.into_iter().collect();
    let first_cell = today - Duration::days(days - 1);
    let cells = (0..days)
        .map(|offset| {
            let day = first_cell + Duration::days(offset);
            let state = if expected_set.contains(&day) {
                streak::state_of(day, &done, grace, today)
            } else {
                CellState::NotExpected
            };
            DayCell {
                date: completion::format(day),
                state,
            }
        })
        .collect();

    Ok(StreakCard {
        current: summary.current,
        longest: summary.longest,
        done_today: done.contains(&today),
        cells,
        task: habit,
    })
}
```

- [ ] **Step 7: Add `grace_days` to the settings repository**

In `app/src-tauri/src/repo/settings.rs`, add below `get`:

```rust
/// Just the grace number, for the streak math. Read on every streak computation
/// so changing it in Settings updates every card immediately.
pub fn grace_days(conn: &Connection) -> Result<i64> {
    let grace = conn.query_row(
        "SELECT streak_grace_days FROM settings WHERE id = 1",
        [],
        |row| row.get(0),
    )?;
    Ok(grace)
}
```

- [ ] **Step 8: Add `list_recurring` and switch `list` to `TaskSummary`**

In `app/src-tauri/src/repo/task.rs`, add the imports and replace `list`:

```rust
use crate::models::{Recurrence, Task, TaskInput, TaskStatus, TaskSummary, TaskUpdate};
```

```rust
/// Columns qualified with the table alias, for the joined summary query.
const SUMMARY_COLUMNS: &str = "t.id, t.title, t.status, t.due_date, t.goal_id, t.subgoal_id,
     t.recurrence, t.created_at, t.updated_at";

/// The board's list. One join rather than a completion query per row.
pub fn list(conn: &Connection) -> Result<Vec<TaskSummary>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {SUMMARY_COLUMNS}, c.id IS NOT NULL AS completed_today
         FROM tasks t
         LEFT JOIN task_completions c
             ON c.task_id = t.id AND c.completed_on = ?1
         ORDER BY (t.due_date IS NULL), t.due_date, t.id"
    ))?;

    let tasks = stmt
        .query_map(params![super::completion::format(super::today())], |row| {
            Ok(TaskSummary {
                completed_today: row.get("completed_today")?,
                task: map(row)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;

    Ok(tasks)
}

/// Every habit, for the streak cards.
pub fn list_recurring(conn: &Connection) -> Result<Vec<Task>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM tasks WHERE recurrence IS NOT NULL {ORDER}"
    ))?;
    let tasks = stmt.query_map([], map)?.collect::<rusqlite::Result<_>>()?;
    Ok(tasks)
}
```

The existing test `status_changes_and_deletes` and any other test calling `list` still compiles, because none of them index into the result. If one does, read `.task` off the summary.

- [ ] **Step 9: Exclude habits from progress**

In `app/src-tauri/src/repo/goal.rs`, both `list` and `get_detail` build a `completions` vector. Add the filter to each:

```rust
            let completions: Vec<f64> = direct_tasks
                .iter()
                .filter(|task| task.counts_toward_progress())
                .map(|t| t.status.completion())
                .collect();
```

```rust
    let completions: Vec<f64> = direct_tasks
        .iter()
        .filter(|task| task.counts_toward_progress())
        .map(|t| t.status.completion())
        .collect();
```

In `app/src-tauri/src/repo/subgoal.rs`, `detail_for_goal` needs the same change:

```rust
            let completions: Vec<f64> = tasks
                .iter()
                .filter(|task| task.counts_toward_progress())
                .map(|t| t.status.completion())
                .collect();
```

- [ ] **Step 10: Run the full Rust suite**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS — every earlier test plus the 9 streak-repo tests and 3 completion tests.

- [ ] **Step 11: Commit**

```bash
git add src-tauri/src/repo src-tauri/src/models.rs
git commit -m "feat: derive streak cards from the completion log"
```

---

### Task 4: IPC commands and the grace-period setting

Exposes the three new commands and makes the grace period readable and writable through `Settings`.

**Files:**
- Modify: `app/src-tauri/src/commands.rs` (three commands, handler list)
- Modify: `app/src-tauri/src/models.rs` (`Settings.streak_grace_days`)
- Modify: `app/src-tauri/src/repo/settings.rs` (read the column, add `set_grace_days`)

**Interfaces:**
- Consumes: `repo::streak::{card, list, set_completion, DEFAULT_CELL_DAYS}`, `repo::settings::grace_days` (Task 3).
- Produces:
  - `models::Settings.streak_grace_days: i64`.
  - `repo::settings::set_grace_days(conn, days: i64) -> Result<Settings>`.
  - Commands `list_streaks(days: Option<i64>)`, `set_task_completion(id, date: Option<String>, done: bool)`, `set_streak_grace_days(days: i64)`.
  - `list_tasks` now returns `Vec<TaskSummary>`.

- [ ] **Step 1: Write the failing settings tests**

Add to the `tests` module in `app/src-tauri/src/repo/settings.rs`:

```rust
    #[test]
    fn the_grace_period_starts_at_two_days() {
        let conn = db::open_in_memory().unwrap();

        assert_eq!(get(&conn).unwrap().streak_grace_days, 2);
        assert_eq!(grace_days(&conn).unwrap(), 2);
    }

    #[test]
    fn the_grace_period_can_be_changed_within_range() {
        let conn = db::open_in_memory().unwrap();

        assert_eq!(set_grace_days(&conn, 0).unwrap().streak_grace_days, 0);
        assert_eq!(set_grace_days(&conn, 7).unwrap().streak_grace_days, 7);
    }

    #[test]
    fn rejects_a_grace_period_outside_zero_to_seven() {
        let conn = db::open_in_memory().unwrap();

        assert_eq!(set_grace_days(&conn, 8).unwrap_err().kind(), "validation");
        assert_eq!(set_grace_days(&conn, -1).unwrap_err().kind(), "validation");
        assert_eq!(get(&conn).unwrap().streak_grace_days, 2, "a rejected value must not stick");
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml settings`
Expected: FAIL to compile — no field `streak_grace_days` on `Settings`, no function `set_grace_days`.

- [ ] **Step 3: Add the field and the setter**

In `app/src-tauri/src/models.rs`, extend `Settings`:

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub active_theme: String,
    /// How many days late an occurrence may be logged and still count. 0–7.
    pub streak_grace_days: i64,
    pub updated_at: String,
}
```

In `app/src-tauri/src/repo/settings.rs`, extend the query in `get` and add the setter below `set_theme`:

```rust
pub fn get(conn: &Connection) -> Result<Settings> {
    let settings = conn.query_row(
        "SELECT active_theme, streak_grace_days, updated_at FROM settings WHERE id = 1",
        [],
        |row| {
            Ok(Settings {
                active_theme: row.get("active_theme")?,
                streak_grace_days: row.get("streak_grace_days")?,
                updated_at: row.get("updated_at")?,
            })
        },
    )?;
    Ok(settings)
}
```

```rust
/// Checked here as well as by the schema, so the UI gets a `validation` error
/// with a readable message instead of a raw constraint failure.
pub fn set_grace_days(conn: &Connection, days: i64) -> Result<Settings> {
    if !(0..=7).contains(&days) {
        return Err(Error::Validation(format!(
            "grace period must be between 0 and 7 days, got {days}"
        )));
    }

    conn.execute(
        "UPDATE settings SET streak_grace_days = ?1, updated_at = ?2 WHERE id = 1",
        params![days, now()],
    )?;

    get(conn)
}
```

- [ ] **Step 4: Run the settings tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml settings`
Expected: PASS.

- [ ] **Step 5: Register the commands**

In `app/src-tauri/src/commands.rs`, add the three entries to `command_handlers!` after `delete_task`:

```rust
            $crate::commands::delete_task,
            $crate::commands::list_streaks,
            $crate::commands::set_task_completion,
            $crate::commands::set_streak_grace_days,
```

Change the `list_tasks` signature and add the new commands after `delete_task`:

```rust
#[tauri::command]
pub fn list_tasks(db: State<Db>) -> Result<Vec<TaskSummary>> {
    db.with(|conn| repo::task::list(conn))
}
```

```rust
#[tauri::command]
pub fn list_streaks(db: State<Db>, days: Option<i64>) -> Result<Vec<StreakCard>> {
    let days = days.unwrap_or(repo::streak::DEFAULT_CELL_DAYS);
    db.with(|conn| repo::streak::list(conn, days))
}

/// `date` is a local `YYYY-MM-DD`; omitting it means today, so the frontend
/// never has to decide what "today" is.
#[tauri::command]
pub fn set_task_completion(
    db: State<Db>,
    id: i64,
    date: Option<String>,
    done: bool,
) -> Result<StreakCard> {
    let on = match date {
        Some(text) => Some(
            chrono::NaiveDate::parse_from_str(&text, repo::completion::DATE_FORMAT)
                .map_err(|err| crate::error::Error::Validation(format!("bad date {text}: {err}")))?,
        ),
        None => None,
    };

    db.with(|conn| repo::streak::set_completion(conn, id, on, done, repo::streak::DEFAULT_CELL_DAYS))
}

#[tauri::command]
pub fn set_streak_grace_days(db: State<Db>, days: i64) -> Result<Settings> {
    db.with(|conn| repo::settings::set_grace_days(conn, days))
}
```

- [ ] **Step 6: Run the full Rust suite**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS, with no warnings about unused functions.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/models.rs src-tauri/src/repo/settings.rs
git commit -m "feat: expose streak and grace period commands over IPC"
```

---

### Task 5: Frontend API layer

Mirrors the new Rust types in TypeScript and adds the three call wrappers. Nothing renders yet; this task exists so the later UI tasks have types to lean on.

**Files:**
- Modify: `app/src/lib/api/types.ts`
- Modify: `app/src/lib/api/index.ts`
- Modify: `app/src/lib/api/settings.ts`
- Modify: `app/src/routes/tasks/+page.ts` (load streaks alongside tasks)
- Modify: `app/src/routes/settings/+page.ts` (load settings for the stepper)

**Interfaces:**
- Consumes: the IPC commands from Task 4.
- Produces:
  - Types `Recurrence`, `CellState`, `DayCell`, `StreakCard`, `TaskSummary`; `Task.recurrence` replaces `Task.isRecurring`; `Settings.streakGraceDays`.
  - Constants `RECURRENCES: Recurrence[]`, `RECURRENCE_LABELS: Record<Recurrence, string>`.
  - `listStreaks(days?: number): Promise<StreakCard[]>`
  - `setTaskCompletion(id: number, done: boolean, date?: string | null): Promise<StreakCard>`
  - `setStreakGraceDays(days: number): Promise<Settings>`
  - `/tasks` load returns `{ tasks: TaskSummary[], streaks: StreakCard[], goals, subgoals, error }`.
  - `/settings` load returns `{ categories, settings: Settings | null, error }`.

- [ ] **Step 1: Update the types**

In `app/src/lib/api/types.ts`, add next to the other unions at the top:

```typescript
export type Recurrence = 'daily' | 'weekdays' | 'weekly';
export type CellState = 'done' | 'missed' | 'pending' | 'not_expected';

export const RECURRENCES: Recurrence[] = ['daily', 'weekdays', 'weekly'];

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
	daily: 'Daily',
	weekdays: 'Weekdays',
	weekly: 'Weekly'
};
```

Replace `isRecurring: boolean;` with `recurrence: Recurrence | null;` in all three of `Task`, `TaskInput` and `TaskUpdate`.

Add `streakGraceDays: number;` to `Settings`, between `activeTheme` and `updatedAt`.

Add at the end of the file:

```typescript
/** One square on a heatmap. `date` is a local `YYYY-MM-DD`. */
export interface DayCell {
	date: string;
	state: CellState;
}

export interface StreakCard {
	task: Task;
	current: number;
	longest: number;
	doneToday: boolean;
	cells: DayCell[];
}

/** A task as the board lists it: the record plus today's completion state. */
export interface TaskSummary extends Task {
	completedToday: boolean;
}
```

- [ ] **Step 2: Add the call wrappers**

In `app/src/lib/api/index.ts`, add `StreakCard` and `TaskSummary` to the type import list, change the `listTasks` return type, and add the streak calls after `deleteTask`:

```typescript
export const listTasks = () => call<TaskSummary[]>('list_tasks');
```

```typescript
export const listStreaks = (days?: number) => call<StreakCard[]>('list_streaks', { days: days ?? null });
/** `date` is a local `YYYY-MM-DD`; omit it to mean today. */
export const setTaskCompletion = (id: number, done: boolean, date: string | null = null) =>
	call<StreakCard>('set_task_completion', { id, date, done });
```

In `app/src/lib/api/settings.ts`, add:

```typescript
export const setStreakGraceDays = (days: number) => call<Settings>('set_streak_grace_days', { days });
```

- [ ] **Step 3: Load the new data on both routes**

Replace `app/src/routes/tasks/+page.ts` with:

```typescript
import { listGoals, listStreaks, listSubgoals, listTasks } from '$lib/api';

export const load = async () => {
	try {
		// Goals and subgoals come along so a task can name its parent and offer the
		// full parent list without a second round trip per card.
		const [tasks, streaks, goals, subgoals] = await Promise.all([
			listTasks(),
			listStreaks(),
			listGoals(),
			listSubgoals()
		]);
		return { tasks, streaks, goals, subgoals, error: null };
	} catch (error) {
		// Shown in place, so the board and its navigation stay usable.
		return { tasks: [], streaks: [], goals: [], subgoals: [], error };
	}
};
```

Replace `app/src/routes/settings/+page.ts` with:

```typescript
import { listCategories } from '$lib/api';
import { getSettings } from '$lib/api/settings';

export const load = async () => {
	try {
		const [categories, settings] = await Promise.all([listCategories(), getSettings()]);
		return { categories, settings, error: null };
	} catch (error) {
		return { categories: [], settings: null, error };
	}
};
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: FAIL — `TaskDrawer.svelte` and `tasks/+page.svelte` still reference `task.isRecurring`, which no longer exists. That is expected; Task 7 fixes both. Confirm those are the *only* errors reported and that none of them are in `src/lib/api/`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api src/routes/tasks/+page.ts src/routes/settings/+page.ts
git commit -m "feat: add streak types and calls to the frontend API layer"
```

---

### Task 6: Streak card components

The two presentational pieces, built with no route coupling so the Phase 7 dashboard can drop them in unchanged.

**Files:**
- Create: `app/src/lib/components/StreakHeatmap.svelte`
- Create: `app/src/lib/components/StreakCard.svelte`
- Modify: `app/src/lib/format.ts` (add `cellTitle`)
- Modify: `app/src/lib/format.spec.ts` (test it)

**Interfaces:**
- Consumes: `DayCell`, `StreakCard`, `RECURRENCE_LABELS` (Task 5).
- Produces:
  - `format.cellTitle(cell: DayCell, now?: Date): string` — the hover tooltip for one square.
  - `StreakHeatmap.svelte` — props `{ cells: DayCell[] }`.
  - `StreakCard.svelte` — props `{ card: StreakCardType, busy?: boolean, onToggle?: (done: boolean) => void }`.

- [ ] **Step 1: Write the failing test for the tooltip helper**

Add to `app/src/lib/format.spec.ts`:

```typescript
describe('cellTitle', () => {
	const now = new Date(2026, 6, 31);

	it('names the state of a day', () => {
		expect(cellTitle({ date: '2026-07-30', state: 'done' }, now)).toBe('Jul 30 · done');
		expect(cellTitle({ date: '2026-07-28', state: 'missed' }, now)).toBe('Jul 28 · missed');
		expect(cellTitle({ date: '2026-07-31', state: 'pending' }, now)).toBe('Jul 31 · not yet');
	});

	it('says a day was never expected', () => {
		expect(cellTitle({ date: '2026-07-25', state: 'not_expected' }, now)).toBe(
			'Jul 25 · not scheduled'
		);
	});
});
```

Add `cellTitle` to the existing import at the top of the file, and `import type { DayCell } from '$lib/api'` if the file does not already import from there.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- --run src/lib/format.spec.ts`
Expected: FAIL — `cellTitle is not a function` / import error.

- [ ] **Step 3: Implement the helper**

Add to `app/src/lib/format.ts`:

```typescript
import type { CellState, DayCell } from '$lib/api/types';

const CELL_WORDS: Record<CellState, string> = {
	done: 'done',
	missed: 'missed',
	pending: 'not yet',
	not_expected: 'not scheduled'
};

/** Hover text for one heatmap square: "Jul 30 · done". */
export function cellTitle(cell: DayCell, now: Date = new Date()): string {
	return `${formatDate(cell.date, now)} · ${CELL_WORDS[cell.state]}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- --run src/lib/format.spec.ts`
Expected: PASS.

- [ ] **Step 5: Build the heatmap**

Create `app/src/lib/components/StreakHeatmap.svelte`:

```svelte
<script lang="ts">
	import type { CellState, DayCell } from '$lib/api';
	import { cellTitle } from '$lib/format';
	import { stagger } from '$lib/motion';

	interface Props {
		cells: DayCell[];
	}

	let { cells }: Props = $props();

	/**
	 * Done reads as the accent; a closed miss is a faint outline rather than an
	 * alarm colour, because a broken streak is information, not an error.
	 */
	const CELL_CLASSES: Record<CellState, string> = {
		done: 'bg-accent-secondary',
		missed: 'bg-subtle/40',
		pending: 'bg-subtle/40 ring-1 ring-accent/40 ring-inset',
		not_expected: 'bg-subtle/15'
	};
</script>

<div
	class="grid w-full gap-[3px]"
	style="grid-template-columns:repeat({cells.length}, minmax(0, 1fr))"
	role="img"
	aria-label="Completion history for the last {cells.length} days"
>
	{#each cells as cell, index (cell.date)}
		<span
			class="mp-enter aspect-square w-full rounded-[2px] {CELL_CLASSES[cell.state]}"
			style="--mp-delay:{stagger(index, 12)}"
			title={cellTitle(cell)}
		></span>
	{/each}
</div>
```

- [ ] **Step 6: Build the card**

Create `app/src/lib/components/StreakCard.svelte`:

```svelte
<script lang="ts">
	import { RECURRENCE_LABELS, type StreakCard } from '$lib/api';
	import Checkbox from './Checkbox.svelte';
	import Icon from './Icon.svelte';
	import StreakHeatmap from './StreakHeatmap.svelte';

	interface Props {
		card: StreakCard;
		busy?: boolean;
		/** Omitted on read-only surfaces, like the Phase 7 dashboard widget. */
		onToggle?: (done: boolean) => void;
	}

	let { card, busy = false, onToggle }: Props = $props();

	const cadence = $derived(
		card.task.recurrence ? RECURRENCE_LABELS[card.task.recurrence] : 'One-off'
	);
</script>

<div class="rounded-[14px] border border-subtle bg-surface p-[18px]">
	<div class="mb-3 flex items-center gap-2.5">
		<Icon name="flame" size={14} class="shrink-0 text-accent" />
		<span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{card.task.title}</span>
		<b class="text-sm tabular-nums">{card.current}</b>
		<span class="text-xs text-muted">best {card.longest}</span>
	</div>

	<div class="mb-3 flex items-center justify-between gap-3">
		<span class="text-[11.5px] text-muted">{cadence}</span>
		{#if onToggle}
			<Checkbox
				checked={card.doneToday}
				disabled={busy}
				label="Done today: {card.task.title}"
				showLabel={false}
				onchange={(done) => onToggle(done)}
			/>
		{/if}
	</div>

	<StreakHeatmap cells={card.cells} />
</div>
```

- [ ] **Step 7: Type-check the new components**

Run: `npm run check`
Expected: the same `isRecurring` errors from Task 5 in `TaskDrawer.svelte` and `tasks/+page.svelte`, and **no** new errors in `StreakCard.svelte`, `StreakHeatmap.svelte` or `format.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/StreakCard.svelte src/lib/components/StreakHeatmap.svelte src/lib/format.ts src/lib/format.spec.ts
git commit -m "feat: add streak card and heatmap components"
```

---

### Task 7: Task Manager wiring

Puts the cards on the board, makes recurring cards derive their column from the log, and turns the drawer's recurring checkbox into a cadence picker.

**Files:**
- Modify: `app/src/routes/tasks/+page.svelte`
- Modify: `app/src/lib/components/TaskDrawer.svelte`
- Modify: `app/src/lib/format.ts` (add `weeklyAnchorLabel`)
- Modify: `app/src/lib/format.spec.ts`

**Interfaces:**
- Consumes: `StreakCard.svelte` (Task 6), `listStreaks` / `setTaskCompletion` and the `TaskSummary` type (Task 5).
- Produces: `format.weeklyAnchorLabel(createdAt: string): string` — e.g. `"Tuesdays"`.

- [ ] **Step 1: Write the failing test for the anchor label**

Add to `app/src/lib/format.spec.ts`:

```typescript
describe('weeklyAnchorLabel', () => {
	it('names the weekday a habit was created on', () => {
		// 2026-07-28T09:00:00Z is a Tuesday.
		expect(weeklyAnchorLabel('2026-07-28T09:00:00Z')).toBe('Tuesdays');
	});

	it('is blank when the timestamp cannot be read', () => {
		expect(weeklyAnchorLabel('not a date')).toBe('');
	});
});
```

Add `weeklyAnchorLabel` to the import at the top of the file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- --run src/lib/format.spec.ts`
Expected: FAIL — `weeklyAnchorLabel is not a function`.

- [ ] **Step 3: Implement the anchor label**

Add to `app/src/lib/format.ts`:

```typescript
/**
 * Which weekday a weekly habit lands on. The backend anchors weekly recurrence
 * to the task's creation weekday, so this reads the same value back for display.
 */
export function weeklyAnchorLabel(createdAt: string): string {
	const created = new Date(createdAt);
	if (Number.isNaN(created.getTime())) return '';

	return `${created.toLocaleDateString(undefined, { weekday: 'long' })}s`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- --run src/lib/format.spec.ts`
Expected: PASS.

- [ ] **Step 5: Convert the drawer's checkbox to a cadence picker**

In `app/src/lib/components/TaskDrawer.svelte`, change the imports:

```typescript
	import {
		createTask,
		RECURRENCE_LABELS,
		RECURRENCES,
		updateTask,
		type GoalSummary,
		type Recurrence,
		type Subgoal,
		type Task
	} from '$lib/api';
	import Drawer from './Drawer.svelte';
	import Icon from './Icon.svelte';
	import Select from './Select.svelte';
	import { weeklyAnchorLabel } from '$lib/format';
	import { field } from './ui';
```

The `Checkbox` import is no longer used here — remove it.

Change the form state and its reset effect:

```typescript
	let form = $state({ title: '', parent: '', dueDate: '', recurrence: '' });
```

```typescript
	$effect(() => {
		if (!open) return;
		error = null;
		titleMissing = false;
		form = {
			title: task?.title ?? '',
			parent: parentKey(task),
			dueDate: task?.dueDate ?? '',
			recurrence: task?.recurrence ?? ''
		};
	});
```

Add the anchor line derivation below `subgoalsByGoal`:

```typescript
	/**
	 * A weekly habit is expected on the weekday it was created, so an existing task
	 * can say which day that is. A new one has no creation date to read yet.
	 */
	const anchorNote = $derived.by(() => {
		if (form.recurrence !== 'weekly') return null;
		if (!task) return 'Weekly habits repeat on the day you create them.';

		const weekday = weeklyAnchorLabel(task.createdAt);
		return weekday ? `Repeats weekly · ${weekday}` : null;
	});
```

In `submit`, change the payload field:

```typescript
		const input = {
			title: form.title.trim(),
			dueDate: form.dueDate || null,
			goalId: kind === 'goal' ? parentId : null,
			subgoalId: kind === 'subgoal' ? parentId : null,
			recurrence: (form.recurrence || null) as Recurrence | null
		};
```

Replace the `<Checkbox …>` block at the bottom of the markup with:

```svelte
	<div>
		<label class={field.label} for="task-recurrence">Repeats</label>
		<Select id="task-recurrence" bind:value={form.recurrence}>
			<option value="">Doesn't repeat</option>
			{#each RECURRENCES as recurrence (recurrence)}
				<option value={recurrence}>{RECURRENCE_LABELS[recurrence]}</option>
			{/each}
		</Select>
		{#if anchorNote}
			<p class="mt-1.5 text-xs text-muted">{anchorNote}</p>
		{/if}
	</div>
```

- [ ] **Step 6: Wire the board**

In `app/src/routes/tasks/+page.svelte`, change the imports:

```typescript
	import {
		deleteTask,
		setTaskCompletion,
		setTaskStatus,
		TASK_STATUS_LABELS,
		TASK_STATUSES,
		type TaskSummary,
		type TaskStatus
	} from '$lib/api';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import StreakCard from '$lib/components/StreakCard.svelte';
	import TaskDrawer from '$lib/components/TaskDrawer.svelte';
	import { button, sectionHeading } from '$lib/components/ui';
	import { dueLabel, dueTone } from '$lib/format';
	import { stagger } from '$lib/motion';
```

Change the two `Task` state annotations to `TaskSummary`:

```typescript
	let editingTask = $state<TaskSummary | null>(null);
	let deletingTask = $state<TaskSummary | null>(null);
```

Change `parentLabel`'s parameter type to `TaskSummary`, and replace the `columns` derivation so a habit's column comes from the log rather than its stored status:

```typescript
	/**
	 * A habit has no lasting status: its column is today's completion state, so the
	 * board empties itself at midnight without any scheduled job.
	 */
	function column(task: TaskSummary): TaskStatus {
		if (!task.recurrence) return task.status;
		return task.completedToday ? 'done' : 'todo';
	}

	const columns = $derived(
		TASK_STATUSES.map((status) => ({
			status,
			label: TASK_STATUS_LABELS[status],
			tasks: data.tasks.filter((task) => column(task) === status)
		}))
	);
```

Add the toggle action next to `advance`:

```typescript
	async function toggleToday(task: TaskSummary, done: boolean) {
		justMovedId = task.id;
		clearTimeout(moveTimer);
		moveTimer = setTimeout(() => (justMovedId = null), 500);

		await run(() => setTaskCompletion(task.id, done));
	}
```

- [ ] **Step 7: Render the streak section and the per-card toggle**

In the same file, add the streak section between the error banners and the `<div class="grid gap-4 md:grid-cols-3">` board:

```svelte
{#if data.streaks.length > 0}
	<section class="mb-6">
		<h2 class="{sectionHeading} mb-3">Streaks</h2>
		<div class="grid gap-4 sm:grid-cols-2">
			{#each data.streaks as card (card.task.id)}
				<StreakCard
					{card}
					{busy}
					onToggle={(done) => toggleToday(card.task as TaskSummary, done)}
				/>
			{/each}
		</div>
	</section>
{/if}
```

Then replace the status pill and the recurring badge inside the card markup. One pill serves both kinds of task — only its label, tooltip and action differ — so add this helper next to `toggleToday` in the `<script>` block:

```typescript
	/**
	 * The pill is the same control either way: a habit toggles today's completion,
	 * an ordinary task walks to the next column.
	 */
	function pill(task: TaskSummary) {
		if (task.recurrence) {
			return {
				label: task.completedToday ? 'Done today' : 'Do today',
				title: task.completedToday ? 'Undo today' : 'Mark done for today',
				act: () => toggleToday(task, !task.completedToday)
			};
		}

		const next = TASK_STATUSES[(TASK_STATUSES.indexOf(task.status) + 1) % TASK_STATUSES.length];
		return {
			label: TASK_STATUS_LABELS[task.status],
			title: `Move to ${TASK_STATUS_LABELS[next]}`,
			act: () => advance(task)
		};
	}
```

and render it once, with the cadence badge below:

```svelte
					<div class="mt-2.5 flex flex-wrap items-center gap-2">
						{@const action = pill(task)}
						<button
							type="button"
							class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 {STATUS_PILL_CLASSES[
								column(task)
							]}"
							disabled={busy}
							title={action.title}
							onclick={action.act}
						>
							{action.label}
						</button>
						{#if parent}
							<a
								href="/goals/{task.goalId}"
								class="max-w-[180px] truncate rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/25"
							>
								{parent}
							</a>
						{/if}
						{#if task.recurrence}
							<span
								class="flex items-center gap-1 rounded-full bg-accent-secondary/15 px-2.5 py-1 text-[11px] font-semibold text-accent-secondary"
							>
								<Icon name="flame" size={11} /> {RECURRENCE_LABELS[task.recurrence]}
							</span>
						{/if}
```

Add `RECURRENCE_LABELS` to the `$lib/api` import list at the top of the file.

Also change the strike-through condition on the title so a habit reads as done when today is logged:

```svelte
						<span
							class="min-w-0 flex-1 text-sm leading-snug font-semibold {column(task) === 'done'
								? 'text-muted line-through'
								: ''}"
						>
```

- [ ] **Step 8: Type-check and lint**

Run: `npm run check`
Expected: PASS with zero errors — the `isRecurring` errors from Task 5 are now resolved.

Run: `npm run format && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/routes/tasks/+page.svelte src/lib/components/TaskDrawer.svelte src/lib/format.ts src/lib/format.spec.ts
git commit -m "feat: show streaks and daily check-off on the task board"
```

---

### Task 8: Grace period stepper in Settings

**Files:**
- Modify: `app/src/routes/settings/+page.svelte`

**Interfaces:**
- Consumes: `setStreakGraceDays` (Task 5) and `data.settings` from the route load (Task 5).
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Add the stepper**

In `app/src/routes/settings/+page.svelte`, add the import:

```typescript
	import { setStreakGraceDays } from '$lib/api/settings';
```

Add the state and handler next to the other handlers:

```typescript
	const grace = $derived(data.settings?.streakGraceDays ?? 2);

	/** The schema and the backend both cap this at 0–7; the buttons just agree. */
	async function nudgeGrace(delta: number) {
		const next = Math.min(7, Math.max(0, grace + delta));
		if (next === grace) return;
		await run(() => setStreakGraceDays(next));
	}
```

Add the section between the Categories section and the About section:

```svelte
<section class="mb-8">
	<h2 class="{sectionHeading} mb-3">Streaks</h2>
	<div
		class="flex max-w-[420px] items-center gap-4 rounded-xl border border-subtle bg-surface p-4"
	>
		<div class="flex-1">
			<div class="mb-0.5 text-[13.5px] font-semibold">Grace period</div>
			<div class="text-xs text-muted">Missing days within this window won't break a streak</div>
		</div>
		<button
			type="button"
			class={button.icon}
			disabled={busy || grace === 0}
			aria-label="Decrease grace period"
			onclick={() => nudgeGrace(-1)}
		>
			<Icon name="close" size={13} />
		</button>
		<span class="min-w-[52px] text-center text-[15px] font-bold tabular-nums">
			{grace} {grace === 1 ? 'day' : 'days'}
		</span>
		<button
			type="button"
			class={button.icon}
			disabled={busy || grace === 7}
			aria-label="Increase grace period"
			onclick={() => nudgeGrace(1)}
		>
			<Icon name="plus" size={13} />
		</button>
	</div>
</section>
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run check`
Expected: PASS.

Run: `npm run format && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/settings/+page.svelte
git commit -m "feat: add the streak grace period stepper to settings"
```

---

### Task 9: End-to-end coverage and the full gate

Extends the Playwright shell tests to the new controls and runs everything together. These tests run against the plain web build with no Tauri backend, so they assert the controls exist and are labelled, not that data flows — CRUD stays covered by the Rust tests.

**Files:**
- Modify: `app/e2e/shell.e2e.ts`

**Interfaces:**
- Consumes: the rendered `/tasks` and `/settings` routes (Tasks 7–8).
- Produces: nothing.

- [ ] **Step 1: Write the failing tests**

Add to `app/e2e/shell.e2e.ts`:

```typescript
test('the settings screen offers the streak grace period', async ({ page }) => {
	await page.goto('/settings');

	await expect(page.getByRole('heading', { name: 'Streaks' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Increase grace period' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Decrease grace period' })).toBeVisible();
});

test('the task drawer offers every cadence', async ({ page }) => {
	await page.goto('/tasks');
	await page.getByRole('button', { name: 'New Task' }).click();

	const repeats = page.getByLabel('Repeats');
	await expect(repeats).toBeVisible();
	for (const option of ["Doesn't repeat", 'Daily', 'Weekdays', 'Weekly']) {
		await expect(repeats.getByRole('option', { name: option })).toBeAttached();
	}
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:e2e -- --grep "grace period|every cadence"`
Expected: FAIL if run before Tasks 7–8 landed. If those tasks are already committed, expect PASS — in that case confirm the selectors match by temporarily renaming one label, then restore it.

- [ ] **Step 3: Run the full gate**

Run: `npm test`
Expected: PASS — Vitest, `cargo test`, and Playwright all green.

- [ ] **Step 4: Verify the real app by hand**

Run: `npm run tauri dev`

Confirm, in the running desktop app:
1. Creating a task with **Repeats: Daily** makes a streak card appear above the board.
2. Checking the card's box moves the task to Done and fills today's heatmap square.
3. Unchecking it moves the task back to To do and clears the square.
4. The Settings stepper changes the number and clamps at 0 and 7.
5. A goal with only a recurring task shows 0% progress, and a goal with one done ordinary task plus a habit shows 100%.

- [ ] **Step 5: Commit**

```bash
git add e2e/shell.e2e.ts
git commit -m "test: cover the streak controls in the shell e2e suite"
```

---

## Self-Review

**Spec coverage.** Migration 2 → Task 1. Local dates → Task 3 (`repo::today`, `local_date_of`). Streak math and all six listed test cases → Task 2. Completion repository → Task 3. `StreakCard` / `DayCell` / `CellState` → Tasks 2–3. `TaskSummary` and the LEFT JOIN → Task 3. Progress exclusion → Task 3. The three commands → Task 4. Grace column, setter and validation → Tasks 1 and 4. Frontend types and calls → Task 5. `StreakCard.svelte` / `StreakHeatmap.svelte` → Task 6. Board wiring, derived column, cadence picker, weekly anchor line → Task 7. Settings stepper → Task 8. Playwright → Task 9.

**Naming consistency.** `state_of` is used in `streak.rs` and in `repo/streak.rs`'s `build`. `DEFAULT_CELL_DAYS` is defined in `repo::streak` and consumed in `commands.rs`. `counts_toward_progress` is defined in Task 1 and used in Task 3. `cellTitle` and `weeklyAnchorLabel` are defined and consumed within Tasks 6 and 7 respectively.

**Known ordering note.** `npm run check` fails between Tasks 5 and 7 by design, because the API types change before the components that consume them. Task 5 Step 4 says so explicitly and bounds which errors are acceptable.
