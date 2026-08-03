# Task Manager Kanban Parity — Design

## Goal

`TODO.md` ("Fixing the inconsistent Kanban"): the goal-detail Kanban board
(`app/src/lib/components/KanbanBoard.svelte`, added in the Phase 4 Kanban
work) is drag-and-drop with chevron steppers; the Task Manager board
(`app/src/routes/tasks/+page.svelte`) is a separate, bespoke board — one-way
pill-click to advance, no drag, no stepper. Unify by extending
`KanbanBoard.svelte` to cover Task Manager's extra needs and using it on both
pages, per the TODO's own "(maybe make component for this)".

## Scope

- `app/src/lib/components/KanbanBoard.svelte` — extended with new props.
- `app/src/routes/tasks/+page.svelte` — bespoke board block replaced with
  `<KanbanBoard>`; local `taskColumn`/`columns`/`pill`/`advance`/
  `STATUS_PILL_CLASSES`/pulse state removed (now inside the shared board).
  `StreakCard` section above the board is untouched — separate concern, not
  part of the board.
- `app/src/routes/goals/[id]/+page.svelte` — gains a `deletingTask` +
  `ConfirmDialog` pair for board-initiated task deletion (goal page currently
  has no way to delete a task from the board at all), and passes the new
  props.

## New/changed `KanbanBoard.svelte` props

```ts
interface Props {
	goalId?: number | null; // omitted/null → quick-add creates a goal-less task
	tasks: TaskSummary[];
	subgoals: SubgoalDetail[];
	goals?: GoalSummary[]; // only needed when parentChipMode is 'goal-and-subgoal'
	parentChipMode: 'subgoal-only' | 'goal-and-subgoal';
	onMutated: () => Promise<void> | void;
	onError: (error: unknown) => void;
	onEditTask: (task: TaskSummary) => void;
	onDeleteTask: (task: TaskSummary) => void; // new
}
```

Goal page passes `parentChipMode="subgoal-only"`, no `goals` prop (unchanged
subgoal-name lookup). Tasks page passes `parentChipMode="goal-and-subgoal"`,
`goalId={null}`, `goals={data.goals}`.

## Behavior changes inside the board

- **Delete.** Hover trash icon on every card, both pages (mirrors the
  existing hover edit icon). Calls `onDeleteTask(task)`; the parent page owns
  the `ConfirmDialog` and the actual `deleteTask` call + `onMutated()`, same
  division of responsibility `/tasks` already uses for its `deletingTask`
  state today.
- **Parent chip.** `parentChipMode === 'subgoal-only'` keeps today's
  goal-page chip (subgoal name via `subgoals` prop, omitted for direct
  tasks). `'goal-and-subgoal'` renders the `/tasks` page's existing
  `parentLabel()` logic (`"Goal / Subgoal"`, `"Goal"`, or nothing), now fed by
  the board's own `goals`/`subgoals` props instead of page-level derived
  maps.
- **Habit action.** Card action row branches on `task.recurrence`: habits
  render the existing `/tasks` labeled pill (`Do today` / `Done today` /
  `Not due today`, calling `setTaskCompletion` via the board's existing
  `moveTask()` habit branch); non-habits keep the chevron steppers + drag,
  unchanged from today's goal-page board.
- **Click-title.** Opens the drawer via `onEditTask` on both pages (already
  goal-page behavior). Tasks page's pencil icon stays for hover
  discoverability/parity with the new delete icon, even though now
  redundant with click-title.
- **Move pulse.** The `justMovedId` / `mp-pulse` ~500ms border-accent pulse
  (currently `/tasks`-only, on `advance`/`toggleToday`) moves into the board
  and fires uniformly after drag-drop, stepper-click, or habit-pill-toggle,
  on both pages. Partially addresses TODO item 3 ("dopamine feedback") as a
  side effect — no further feedback (sound, confetti, etc.) is in scope here.
- **Quick-add.** Unchanged when `goalId` is set (goal page: task created
  scoped to that goal). When `goalId` is `null`/omitted (`/tasks`),
  `createTask` is called with `goalId: null` — a standalone task, same
  dashed-input pattern as today's goal-page quick-add.

## Error handling

Unchanged pattern: board mutations funnel through the existing `run()`
helper → `onMutated()` on success, `onError()` on failure, parent page shows
its existing `ErrorBanner`. Delete failures surface the same way once the
parent's `deleteTask` call rejects inside its own confirm-flow handler.

## Testing

No new Playwright e2e — `test:e2e` runs against the plain web build with no
Tauri backend, which the project's own `shell.e2e.ts` notes can't exercise
CRUD flows at all (see `plans/playwright-test-plan.md`); board mutations here
are all CRUD. No new pure logic is introduced (parent-chip branching and
habit-pill branching are template-level, not worth extracting); existing
`kanban.spec.ts` coverage of `groupByStatus`/`taskColumn` is unaffected and
sufficient.

## Out of scope

- New move-feedback beyond reusing the existing pulse (rest of TODO item 3).
- Column reordering / persisted card order (unchanged from Phase 4 Kanban
  design — still no `position` field on `Task`).
- Any change to `StreakCard` or the streaks section above the `/tasks` board.
