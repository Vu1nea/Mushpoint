# Task Calendar View — Design

## Goal

Add a Calendar view to Task Manager (`/tasks`) as an alternative to the
existing Kanban board: a month grid where each day cell lists the tasks due
that day, with drag-and-drop to reschedule. Pure frontend feature — no
schema change, no new backend query. `updateTask` already accepts `dueDate`.

## Scope

`app/src/routes/tasks/+page.svelte` only. Mirrors the List/Kanban toggle
already shipped on the goal-detail page
(`2026-08-03-goal-kanban-view-design.md`), but for Board/Calendar on the
Task Manager page specifically. Does not touch `goals/[id]/+page.svelte` or
its `KanbanBoard` usage.

## View toggle

Segmented control (`segment()` from `$lib/components/ui`, same markup as the
goal-detail page's List/Kanban toggle) in the page header: **Board |
Calendar**. Default Board.

State persists client-side only, in `localStorage` under `mp-tasks-view`,
read on mount behind the existing `browser` check (`$lib/motion.ts` has the
pattern), written on toggle. Same reasoning as the goal-view toggle: a UI
display preference, not domain data.

## New pure helper: `app/src/lib/calendar.ts`

Mirrors the existing `kanban.ts` (`groupByStatus`) pattern — pure function,
no DOM, independently testable.

```ts
export function tasksByDay(tasks: TaskSummary[], days: string[]): Map<string, TaskSummary[]>
```

For each `day` in `days`, a task belongs on it if either:

- **Non-recurring:** `task.dueDate === day`.
- **Recurring:** `task.recurrence` is set and
  `isExpectedOn(task.recurrence, weekdayOf(localDateOf(task.createdAt)), day)`
  is true (both from `$lib/db/logic/streak.ts` / `dates.ts` — pure, no
  driver dependency, already covered by their own spec files). Shown on
  every expected day regardless of `dueDate`, per the recurring-task
  answer above.

A task with both conditions true on the same day (a habit that also carries
a `dueDate` landing on an expected day) is deduped — appears once.

Tested in `app/src/lib/calendar.spec.ts`, same convention as
`kanban.spec.ts`.

## New component: `app/src/lib/components/CalendarView.svelte`

Same prop shape as `KanbanBoard.svelte`, so `tasks/+page.svelte` swaps
between the two with no data-flow changes:

```ts
interface Props {
	tasks: TaskSummary[];
	subgoals: Pick<SubgoalDetail, 'id' | 'title'>[];
	goals?: GoalSummary[];
	parentChipMode: 'subgoal-only' | 'goal-and-subgoal';
	onMutated: () => Promise<void> | void;
	onError: (error: unknown) => void;
	onEditTask: (task: TaskSummary) => void;
	onDeleteTask: (task: TaskSummary) => void;
}
```

### Month grid

Reuses `mushpoint-design/utils/calendarGrid` (already powers `DatePicker`):
`monthGrid(viewYear, viewMonth, null, todayIso())` — 42 Sunday-first cells
(`iso`, `day`, `inCurrentMonth`, `isToday`). Local `viewYear`/`viewMonth`
state initialized from `todayIso()`. Header: prev/next month chevrons (same
icon-button style as `DatePicker`'s panel header) + `monthLabel()` + a
"Today" button that resets the view to the current month.

`days` passed to `tasksByDay` is the 42 cell isos; result is a `$derived`
`Map` recomputed when `tasks` or the visible month changes.

### Day cell

Day number (dimmed text if `!inCurrentMonth`, accent ring if `isToday`).
Below it, up to 3 task chips from the day's bucket, then a static "+N more"
label if there are more (no interaction on the label — out of scope for
v1). Chip shows title (truncated), recurrence flame icon
(`RECURRENCE_LABELS`/flame markup from `TaskRow.svelte`) if recurring, and
due-date color via `dueTone`/`DUE_CLASSES` (same as every other task
surface). Clicking a chip calls `onEditTask(task)` — opens the existing
`TaskDrawer`, unchanged.

### Drag reschedule

Native HTML5 DnD, copying `KanbanBoard.svelte`'s exact
`dragstart`/`dragover`/`drop` pattern — no new dependency, no library.

Only non-recurring chips are `draggable`. A habit's occurrence is derived
from its creation weekday (`isExpectedOn`), not `dueDate`, so dragging it
onto a day wouldn't change anything meaningful — its chips render
`draggable={false}` and are visually inert on drag (same as
`KanbanBoard`'s `inert` treatment for a habit not expected today).

Dropping a draggable chip on a cell calls:

```ts
updateTask(task.id, {
	title: task.title,
	status: task.status,
	dueDate: cell.iso,
	goalId: task.goalId,
	subgoalId: task.subgoalId,
	recurrence: task.recurrence
});
```

(full `TaskUpdate` object — the repo's `update()` requires all fields, same
constraint `TaskDrawer`'s save already works within), then `onMutated()`.
Wrapped in the same `run()` busy/error helper as `KanbanBoard`, reusing the
page's existing `actionError` banner on failure. No optimistic move — the
chip stays on its original day until `invalidateAll` reconciles.

Dropping on the cell the task is already showing on is a no-op (skip the
call if `task.dueDate === cell.iso`).

## `tasks/+page.svelte` changes

- `view = $state<'board' | 'calendar'>('board')`, read/written to
  `localStorage['mp-tasks-view']` on mount/toggle (behind `browser` check).
- Segment toggle added to the header, next to the "New Task" button.
- Conditionally render `<KanbanBoard ... />` or `<CalendarView ... />` with
  identical props (both already receive `data.tasks`, `data.subgoals`,
  `data.goals`, `invalidateAll`, `actionError` setter, `edit`,
  `deletingTask` setter) — no loader change needed.

## Tests

- Vitest: `calendar.spec.ts` covers `tasksByDay` — non-recurring due-date
  match, each recurrence cadence (`daily`/`weekdays`/`weekly`) expanding
  across a month, dedup when both conditions hit the same day, and days
  with no tasks.
- Manual QA: toggle persists across reload; drag moves a task's due date
  and survives reload; habit chips are visibly non-draggable; month
  navigation and "Today" work at month boundaries (Jan/Dec rollover).

## Out of scope

- Week view
- Interactive "+N more" overflow (expand cell / popover)
- Creating a task directly from a day cell (quick-add) — use the existing
  "New Task" button / drawer
- Server-side/cross-device persistence of the Board/Calendar toggle
- Multi-day/ranged tasks (no schema support — `Task` has one `dueDate`)
