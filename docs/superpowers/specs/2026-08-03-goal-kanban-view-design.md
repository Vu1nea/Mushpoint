# Goal Kanban View — Design

## Goal

Phase 4 of `docs/plans/goal_tracker_plan.md`: let a Goal's tasks be viewed as a
drag-and-drop Kanban board instead of the flat list. Per the plan's
architectural pivot, Kanban is a **view over existing Goal tasks** — no
separate board/project entity, no schema change. Columns are fixed
(`To Do` / `In Progress` / `Done`), matching `TaskStatus`.

## Scope

`app/src/routes/goals/[id]/+page.svelte` only. Task Manager (`/tasks`) keeps
its flat table; this is specific to a single goal's task set (direct tasks +
all subgoal tasks).

## View toggle

Segmented control (existing `segment()` style, same visual family as the
goal-status pills) placed above the Subgoals/Direct tasks section: **List |
Kanban**. Default List.

State persists client-side only, per goal, in `localStorage` under
`mp-goal-view-{goalId}`. Read on mount behind the existing `browser` check
(see `app/src/lib/motion.ts` for the pattern), written on toggle. No backend
field — a UI display preference, not domain data, and per the plan's own
"doesn't earn its own table" reasoning (see `2026-08-02-goal-repo-url-design.md`)
this is even lighter than a scalar column.

## Data

`app/src/routes/goals/[id]/+page.ts` loader adds `listGoals()` and
`listSubgoals()` alongside the existing `getGoal()` / `listCategories()`
calls (same shape as `app/src/routes/tasks/+page.ts`), so `TaskDrawer` can
offer full parent reassignment when a card is opened for editing.

Board's task set, computed client-side, no new query:

```ts
const boardTasks = $derived([
	...goal.directTasks,
	...goal.subgoals.flatMap((s) => s.tasks)
]);
```

Grouped into 3 arrays by `status` for rendering.

## New component: `app/src/lib/components/KanbanBoard.svelte`

Props:

```ts
interface Props {
	tasks: TaskSummary[];
	subgoals: SubgoalDetail[]; // for subgoal-name chip lookup by id
	onMutated: () => Promise<void> | void;
	onError: (error: unknown) => void;
}
```

Renders 3 columns from `TASK_STATUSES`, header = `TASK_STATUS_LABELS[status]`
+ card count. Each column:

- Cards for tasks in that status, rendered with `animate:flip` keyed by
  `task.id`, duration `motion(200)` (collapses to 0 under
  `prefers-reduced-motion`, same as the rest of the app).
- Empty state: muted "No tasks" text, matching existing empty-state copy
  style elsewhere in the app.
- Dashed quick-add input at the bottom (`field.dashed`, same pattern as the
  existing "+ Add a task…" forms): calls `createTask` (defaults to `todo`
  status), then `setTaskStatus(id, columnStatus)` if the column isn't To Do.

### Card

Title, subgoal-name chip (looked up from `subgoals` by `task.subgoalId`,
omitted for direct tasks), recurrence flame badge, due-date badge — all
reusing the exact badge markup/classes from `TaskRow.svelte`. Click opens
`TaskDrawer` with `task` set (edit mode), reusing the existing component
as-is.

### Column change

Two independent paths, both terminating in
`setTaskStatus(id, status)` → `onMutated()`:

1. **Drag.** Card has `draggable="true"`; `dragstart` sets
   `dataTransfer` to the task id. Column has `dragover` (`preventDefault`,
   sets a `border-accent` highlight class while active) and `drop` (reads
   the id, computes target status from the column, fires the mutation,
   clears highlight).
2. **Keyboard/no-drag fallback.** Each card carries a `‹ ›` icon-button
   stepper (`button.icon` style, `Icon name="chevron-right"` mirrored for
   `‹`) that moves the card one column left/right. Disabled at the two
   edges (no `‹` on To Do, no `›` on Done). Fully keyboard/click operable
   without relying on native drag.

Mutation failure on either path: same `actionError` banner pattern already
used on the page; card visually stays put until `invalidateAll` reconciles
state (no optimistic column move).

## Tests

- Vitest: pure grouping-by-status logic (extract as a small function, e.g.
  `groupByStatus(tasks): Record<TaskStatus, TaskSummary[]>`, tested directly).
- Playwright e2e (`app/e2e/`): toggle switches List↔Kanban and persists
  across reload; drag moves a card and its status persists after reload;
  stepper fallback moves a card; quick-add creates a task already in the
  correct column.

## Out of scope

- Persisted card order within a column (`Task` has no `position` field —
  only `Subgoal` does; column membership is the only thing tracked)
- Custom/user-defined columns (explicitly out of scope for v1 per the plan)
- Cross-goal board / Task Manager Kanban view
- Server-side/cross-device persistence of the List/Kanban toggle
