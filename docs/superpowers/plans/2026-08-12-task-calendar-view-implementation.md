# Task Calendar View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Board/Calendar toggle to Task Manager (`/tasks`), where Calendar is a month grid whose day cells list tasks due that day (including expanded recurring occurrences), with HTML5 drag-and-drop to reschedule non-recurring tasks.

**Architecture:** One new pure helper (`tasksByDay`) buckets the flat task list into calendar days, reusing the same recurrence-expansion logic the backend already uses for streaks. One new presentational component (`CalendarView.svelte`) renders the grid and owns drag/drop, mirroring `KanbanBoard.svelte`'s exact patterns (same prop shape, same `run()` busy/error wrapper, same native DnD handlers) so it drops into `tasks/+page.svelte` with zero data-flow changes.

**Tech Stack:** SvelteKit 5 (runes), TypeScript, Vitest, Tailwind utility classes, `mushpoint-design` package (calendar grid math, `ui` class helpers).

## Global Constraints

- Frontend-only feature — no schema change, no new backend query, no new dependency (spec: "Pure frontend feature").
- Scope is `app/src/routes/tasks/+page.svelte` and its new supporting files only — do not touch `goals/[id]/+page.svelte` or its `KanbanBoard` usage (spec: Scope).
- Toggle state persists client-side only, in `localStorage['mp-tasks-view']`, read/written behind the SvelteKit `browser` check from `$app/environment` — not domain data (spec: View toggle).
- `CalendarView.svelte` must accept the exact same `Props` shape as `KanbanBoard.svelte` (spec: New component).
- Reuse existing primitives rather than re-implementing: `monthGrid`/`monthLabel`/`shiftMonth`/`todayIso` from `$lib/calendarGrid`, `isExpectedOn`/`weekdayOf`/`localDateOf` for recurrence expansion, `dueTone`/`DUE_CLASSES` for due-date color, `RECURRENCE_LABELS` + flame icon for the habit badge, `segment()`/`button`/`field` for controls.
- Out of scope (do not build): week view, interactive "+N more" overflow, quick-add from a day cell, server-side/cross-device toggle persistence, multi-day/ranged tasks.

---

## File Structure

- **Create** `app/src/lib/calendar.ts` — pure `tasksByDay(tasks, days)` helper, mirrors `app/src/lib/kanban.ts`'s role (`groupByStatus`) for the Board view.
- **Create** `app/src/lib/calendar.spec.ts` — Vitest coverage for `tasksByDay`, mirrors `app/src/lib/kanban.spec.ts`'s `task()` fixture-builder convention.
- **Create** `app/src/lib/components/CalendarView.svelte` — month grid + day cells + drag-reschedule, mirrors `KanbanBoard.svelte`'s structure (props, `run()` helper, native DnD handlers).
- **Modify** `app/src/routes/tasks/+page.svelte` — add the Board/Calendar segment toggle, `view` state + localStorage persistence, conditional render of `KanbanBoard`/`CalendarView`.

No other files change. No loader change — `CalendarView` consumes the same `data.tasks` / `data.subgoals` / `data.goals` already fetched for `KanbanBoard`.

---

## Task 1: `tasksByDay` pure helper

**Files:**
- Create: `app/src/lib/calendar.ts`
- Create: `app/src/lib/calendar.spec.ts`

**Interfaces:**
- Consumes: `TaskSummary` from `$lib/api` (fields used: `dueDate`, `recurrence`, `createdAt`); `isExpectedOn(rec: Recurrence, anchorWeekday: number, day: string): boolean` from `$lib/db/logic/streak`; `weekdayOf(date: string): number` from `$lib/db/logic/dates`; `localDateOf(timestamp: string): string` from `$lib/db/repo/helpers` (all three already used together the same way in `app/src/lib/db/repo/task.ts:47-56`, no driver dependency).
- Produces: `export function tasksByDay(tasks: TaskSummary[], days: string[]): Map<string, TaskSummary[]>` — consumed by Task 2's `CalendarView.svelte`.

- [ ] **Step 1: Write the failing tests**

Create `app/src/lib/calendar.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { TaskSummary } from './api';
import { tasksByDay } from './calendar';

function task(overrides: Partial<TaskSummary> & Pick<TaskSummary, 'id'>): TaskSummary {
	return {
		title: 'Task',
		status: 'todo',
		dueDate: null,
		goalId: null,
		subgoalId: null,
		recurrence: null,
		createdAt: '2026-08-03T12:00:00Z', // a Monday
		updatedAt: '2026-08-03T12:00:00Z',
		completedToday: false,
		expectedToday: true,
		...overrides
	};
}

// Aug 2026: Sat=1, Sun=2, Mon=3, Tue=4, Wed=5, ... Sat=8, Sun=9, Mon=10.
const MON = '2026-08-03';
const TUE = '2026-08-04';
const WED = '2026-08-05';
const SAT = '2026-08-08';
const NEXT_MON = '2026-08-10';
const DAYS = [MON, TUE, WED, SAT, NEXT_MON];

describe('tasksByDay', () => {
	it('gives every input day an empty bucket when there are no tasks', () => {
		const result = tasksByDay([], DAYS);
		expect([...result.keys()]).toEqual(DAYS);
		for (const day of DAYS) expect(result.get(day)).toEqual([]);
	});

	it('places a non-recurring task on its dueDate only', () => {
		const t = task({ id: 1, dueDate: TUE });
		const result = tasksByDay([t], DAYS);

		expect(result.get(TUE)).toEqual([t]);
		expect(result.get(MON)).toEqual([]);
		expect(result.get(WED)).toEqual([]);
	});

	it('leaves a non-recurring task with no dueDate off every day', () => {
		const t = task({ id: 1, dueDate: null });
		const result = tasksByDay([t], DAYS);

		for (const day of DAYS) expect(result.get(day)).toEqual([]);
	});

	it('expands a daily habit onto every day in range', () => {
		const habit = task({ id: 2, recurrence: 'daily', dueDate: null });
		const result = tasksByDay([habit], DAYS);

		for (const day of DAYS) expect(result.get(day)).toEqual([habit]);
	});

	it('expands a weekdays habit onto Mon-Fri only, skipping the weekend', () => {
		const habit = task({ id: 3, recurrence: 'weekdays', dueDate: null });
		const result = tasksByDay([habit], DAYS);

		expect(result.get(MON)).toEqual([habit]);
		expect(result.get(TUE)).toEqual([habit]);
		expect(result.get(WED)).toEqual([habit]);
		expect(result.get(SAT)).toEqual([]);
	});

	it('expands a weekly habit only onto days matching its creation weekday', () => {
		// createdAt above is a Monday, so the anchor weekday is Monday.
		const habit = task({ id: 4, recurrence: 'weekly', dueDate: null });
		const result = tasksByDay([habit], DAYS);

		expect(result.get(MON)).toEqual([habit]);
		expect(result.get(NEXT_MON)).toEqual([habit]);
		expect(result.get(TUE)).toEqual([]);
		expect(result.get(SAT)).toEqual([]);
	});

	it('dedups a habit that also carries a dueDate landing on an expected day', () => {
		const habit = task({ id: 5, recurrence: 'daily', dueDate: MON });
		const result = tasksByDay([habit], DAYS);

		expect(result.get(MON)).toEqual([habit]);
		expect(result.get(MON)?.length).toBe(1);
	});

	it('preserves input task order within a day bucket', () => {
		const a = task({ id: 6, dueDate: MON });
		const b = task({ id: 7, dueDate: MON });
		const result = tasksByDay([a, b], DAYS);

		expect(result.get(MON)?.map((t) => t.id)).toEqual([6, 7]);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run src/lib/calendar.spec.ts`
Expected: FAIL — `Cannot find module './calendar'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/calendar.ts`:

```ts
import type { TaskSummary } from './api';
import { localDateOf } from './db/repo/helpers';
import { weekdayOf } from './db/logic/dates';
import { isExpectedOn } from './db/logic/streak';

/**
 * Buckets tasks onto each day in `days`. A non-recurring task lands on its
 * `dueDate`; a recurring task lands on every day the cadence expects an
 * occurrence, per its creation weekday — same rule the board/streak views
 * already use (`taskColumn` in `./kanban`, `withCompletion` in
 * `./db/repo/task`). A habit that also carries a `dueDate` landing on an
 * expected day is deduped to one entry via the per-task `Set`.
 */
export function tasksByDay(tasks: TaskSummary[], days: string[]): Map<string, TaskSummary[]> {
	const byDay = new Map<string, TaskSummary[]>(days.map((day) => [day, []]));

	for (const task of tasks) {
		const onDays = new Set<string>();
		if (task.dueDate) onDays.add(task.dueDate);

		if (task.recurrence) {
			const anchorWeekday = weekdayOf(localDateOf(task.createdAt));
			for (const day of days) {
				if (isExpectedOn(task.recurrence, anchorWeekday, day)) onDays.add(day);
			}
		}

		for (const day of onDays) {
			byDay.get(day)?.push(task);
		}
	}

	return byDay;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run src/lib/calendar.spec.ts`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/calendar.ts app/src/lib/calendar.spec.ts
git commit -m "feat: add tasksByDay helper for calendar task grouping"
```

---

## Task 2: `CalendarView.svelte` component

**Files:**
- Create: `app/src/lib/components/CalendarView.svelte`

**Interfaces:**
- Consumes: `tasksByDay` from Task 1 (`$lib/calendar`); `monthGrid(year, month, selectedIso, today): CalendarDay[]`, `monthLabel(year, month): string`, `shiftMonth(year, month, delta): {year, month}`, `todayIso(): string` from `$lib/calendarGrid` (`CalendarDay` = `{ iso, day, inCurrentMonth, isToday, isSelected }`); `updateTask(id, TaskUpdate): Promise<Task>`, `RECURRENCE_LABELS`, `type TaskSummary`, `type GoalSummary`, `type SubgoalDetail` from `$lib/api`; `dueTone` from `$lib/format`; `DUE_CLASSES`, `button`, `segment` unused-here (segment lives in Task 3) but `button`/`DUE_CLASSES` from `$lib/components/ui`; `Icon` from `./Icon.svelte`.
- Produces: default export Svelte component with

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

consumed by Task 3's `tasks/+page.svelte` with the identical prop object already passed to `KanbanBoard`. `subgoals`, `goals`, `parentChipMode`, `onDeleteTask` are accepted (so the prop shape matches `KanbanBoard` exactly, per spec) but not used inside the component — v1's day-cell chip shows only title, recurrence icon, and due-date color (spec: Day cell — no parent chip, no delete affordance in the cell).

This task has no automated test (it's a rendering/interaction component, same as `KanbanBoard.svelte` which also has none) — verify manually per Task 3's manual QA checklist after wiring is complete.

- [ ] **Step 1: Write the component**

Create `app/src/lib/components/CalendarView.svelte`:

```svelte
<!-- app/src/lib/components/CalendarView.svelte -->
<script lang="ts">
	import {
		RECURRENCE_LABELS,
		updateTask,
		type GoalSummary,
		type SubgoalDetail,
		type TaskSummary
	} from '$lib/api';
	import { tasksByDay } from '$lib/calendar';
	import { monthGrid, monthLabel, shiftMonth, todayIso } from '$lib/calendarGrid';
	import { dueTone } from '$lib/format';
	import Icon from './Icon.svelte';
	import { button, DUE_CLASSES } from './ui';

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

	let { tasks, onMutated, onError, onEditTask }: Props = $props();

	const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
	const CHIPS_SHOWN = 3;

	const [initialYear, initialMonth] = todayIso().split('-').map(Number);
	let viewYear = $state(initialYear);
	let viewMonth = $state(initialMonth - 1);

	let busy = $state(false);
	let dragOverIso = $state<string | null>(null);

	const grid = $derived(monthGrid(viewYear, viewMonth, null, todayIso()));
	const heading = $derived(monthLabel(viewYear, viewMonth));
	const byDay = $derived(
		tasksByDay(
			tasks,
			grid.map((cell) => cell.iso)
		)
	);

	async function run(action: () => Promise<unknown>) {
		busy = true;
		try {
			await action();
			await onMutated();
		} catch (error) {
			onError(error);
		} finally {
			busy = false;
		}
	}

	function changeMonth(delta: 1 | -1) {
		const next = shiftMonth(viewYear, viewMonth, delta);
		viewYear = next.year;
		viewMonth = next.month;
	}

	function goToday() {
		const [year, month] = todayIso().split('-').map(Number);
		viewYear = year;
		viewMonth = month - 1;
	}

	function dragStart(event: DragEvent, task: TaskSummary) {
		event.dataTransfer?.setData('text/plain', String(task.id));
	}

	function dragOver(event: DragEvent, iso: string) {
		event.preventDefault();
		dragOverIso = iso;
	}

	function dragLeave(iso: string) {
		if (dragOverIso === iso) dragOverIso = null;
	}

	/** Full `TaskUpdate` object — the repo's `update()` requires every field,
	 * same constraint `TaskDrawer`'s save already works within. */
	function reschedule(task: TaskSummary, iso: string) {
		if (task.dueDate === iso) return; // already showing here — no-op
		return run(() =>
			updateTask(task.id, {
				title: task.title,
				status: task.status,
				dueDate: iso,
				goalId: task.goalId,
				subgoalId: task.subgoalId,
				recurrence: task.recurrence
			})
		);
	}

	function drop(event: DragEvent, iso: string) {
		event.preventDefault();
		dragOverIso = null;
		if (busy) return;
		const id = Number(event.dataTransfer?.getData('text/plain'));
		const task = tasks.find((t) => t.id === id);
		if (task) reschedule(task, iso);
	}
</script>

<div class="mb-3.5 flex items-center justify-between gap-2">
	<div class="flex items-center gap-1">
		<button
			type="button"
			class="rounded-control p-1 text-muted transition-colors hover:text-content"
			aria-label="Previous month"
			onclick={() => changeMonth(-1)}
		>
			<Icon name="chevron-right" size={14} weight={2.2} class="rotate-180" />
		</button>
		<h2 class="w-40 text-center text-sm font-semibold">{heading}</h2>
		<button
			type="button"
			class="rounded-control p-1 text-muted transition-colors hover:text-content"
			aria-label="Next month"
			onclick={() => changeMonth(1)}
		>
			<Icon name="chevron-right" size={14} weight={2.2} />
		</button>
	</div>
	<button type="button" class={button.ghost} onclick={goToday}>Today</button>
</div>

<div class="grid grid-cols-7 gap-y-1 text-center">
	{#each WEEKDAYS as weekday (weekday)}
		<span class="text-2xs font-semibold text-muted">{weekday}</span>
	{/each}
</div>

<div class="grid grid-cols-7 gap-px overflow-hidden rounded-card border border-subtle bg-subtle">
	{#each grid as cell (cell.iso)}
		{@const dayTasks = byDay.get(cell.iso) ?? []}
		{@const shown = dayTasks.slice(0, CHIPS_SHOWN)}
		{@const extra = dayTasks.length - shown.length}
		<div
			class="flex min-h-24 flex-col gap-1 bg-surface p-1.5 transition-colors {dragOverIso ===
			cell.iso
				? 'bg-accent/5'
				: ''}"
			ondragover={(event) => dragOver(event, cell.iso)}
			ondragleave={() => dragLeave(cell.iso)}
			ondrop={(event) => drop(event, cell.iso)}
		>
			<span
				class="flex size-5.5 shrink-0 items-center justify-center self-start rounded-full text-2xs font-semibold {cell.inCurrentMonth
					? 'text-content'
					: 'text-muted/50'} {cell.isToday ? 'ring-2 ring-accent' : ''}"
			>
				{cell.day}
			</span>

			{#each shown as task (task.id)}
				<button
					type="button"
					class="flex items-center gap-1 truncate rounded-control bg-surface-raised px-1.5 py-0.5 text-left text-2xs {DUE_CLASSES[
						dueTone(task.dueDate)
					]} {task.recurrence ? '' : 'cursor-grab'}"
					draggable={!task.recurrence}
					ondragstart={(event) => dragStart(event, task)}
					onclick={() => onEditTask(task)}
				>
					{#if task.recurrence}
						<Icon
							name="flame"
							size={10}
							class="shrink-0 text-accent-secondary"
							label={RECURRENCE_LABELS[task.recurrence]}
						/>
					{/if}
					<span class="truncate">{task.title}</span>
				</button>
			{/each}

			{#if extra > 0}
				<span class="px-1.5 text-2xs text-muted/70">+{extra} more</span>
			{/if}
		</div>
	{/each}
</div>
```

- [ ] **Step 2: Type-check**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json`
Expected: no new errors attributable to `CalendarView.svelte`.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/components/CalendarView.svelte
git commit -m "feat: add CalendarView component with drag-to-reschedule"
```

---

## Task 3: Wire the Board/Calendar toggle into `tasks/+page.svelte`

**Files:**
- Modify: `app/src/routes/tasks/+page.svelte`

**Interfaces:**
- Consumes: `CalendarView` from Task 2 (`$lib/components/CalendarView.svelte`); `browser` from `$app/environment`; `segment` from `$lib/components/ui` (already exports `button`, `sectionHeading` — add `segment` to the same import).
- Produces: nothing consumed elsewhere — this is the leaf that ties Tasks 1 and 2 into the page.

- [ ] **Step 1: Add imports and view state**

In `app/src/routes/tasks/+page.svelte`, change the import block (currently lines 1–10):

```svelte
<script lang="ts">
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { deleteTask, setTaskCompletion, type TaskSummary } from '$lib/api';
	import CalendarView from '$lib/components/CalendarView.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import KanbanBoard from '$lib/components/KanbanBoard.svelte';
	import StreakCard from '$lib/components/StreakCard.svelte';
	import TaskDrawer from '$lib/components/TaskDrawer.svelte';
	import { button, sectionHeading, segment } from '$lib/components/ui';

	let { data } = $props();

	let drawerOpen = $state(false);
	let editingTask = $state<TaskSummary | null>(null);
	let deletingTask = $state<TaskSummary | null>(null);
	let busy = $state(false);
	let actionError = $state<unknown>(null);
	let view = $state<'board' | 'calendar'>('board');
```

- [ ] **Step 2: Add localStorage read/write, right after the existing `edit()` function (currently lines 44-47)**

```svelte
	function edit(task: TaskSummary) {
		editingTask = task;
		drawerOpen = true;
	}

	// A UI display preference only — not domain data, so it never touches the
	// backend. Same reasoning as the goal-detail List/Kanban toggle.
	$effect(() => {
		if (!browser) return;
		const stored = localStorage.getItem('mp-tasks-view');
		view = stored === 'calendar' ? 'calendar' : 'board';
	});

	function setView(next: 'board' | 'calendar') {
		view = next;
		if (browser) localStorage.setItem('mp-tasks-view', next);
	}
</script>
```

- [ ] **Step 3: Add the segment toggle to the header**

Replace the existing header block:

```svelte
<header class="mb-6 flex items-start justify-between gap-4">
	<div>
		<h1 class="mb-1 font-display text-3xl font-bold">Tasks</h1>
		<p class="text-sm text-muted">Everything on your plate</p>
	</div>
	<button
		type="button"
		class={button.primary}
		onclick={() => {
			editingTask = null;
			drawerOpen = true;
		}}
	>
		<Icon name="plus" size={15} weight={2.4} />
		New Task
	</button>
</header>
```

with:

```svelte
<header class="mb-6 flex items-start justify-between gap-4">
	<div>
		<h1 class="mb-1 font-display text-3xl font-bold">Tasks</h1>
		<p class="text-sm text-muted">Everything on your plate</p>
	</div>
	<div class="flex items-center gap-2">
		<div class="flex gap-1.5">
			<button
				type="button"
				class={segment(view === 'board')}
				aria-pressed={view === 'board'}
				onclick={() => setView('board')}
			>
				Board
			</button>
			<button
				type="button"
				class={segment(view === 'calendar')}
				aria-pressed={view === 'calendar'}
				onclick={() => setView('calendar')}
			>
				Calendar
			</button>
		</div>
		<button
			type="button"
			class={button.primary}
			onclick={() => {
				editingTask = null;
				drawerOpen = true;
			}}
		>
			<Icon name="plus" size={15} weight={2.4} />
			New Task
		</button>
	</div>
</header>
```

- [ ] **Step 4: Conditionally render `KanbanBoard` / `CalendarView`**

Replace the existing `<KanbanBoard ... />` block with:

```svelte
{#if view === 'board'}
	<KanbanBoard
		tasks={data.tasks}
		subgoals={data.subgoals}
		goals={data.goals}
		parentChipMode="goal-and-subgoal"
		onMutated={invalidateAll}
		onError={(error) => (actionError = error)}
		onEditTask={edit}
		onDeleteTask={(task) => (deletingTask = task)}
	/>
{:else}
	<CalendarView
		tasks={data.tasks}
		subgoals={data.subgoals}
		goals={data.goals}
		parentChipMode="goal-and-subgoal"
		onMutated={invalidateAll}
		onError={(error) => (actionError = error)}
		onEditTask={edit}
		onDeleteTask={(task) => (deletingTask = task)}
	/>
{/if}
```

- [ ] **Step 5: Run the full check + test suite**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json && npx vitest run`
Expected: no type errors; all Vitest suites (including the new `calendar.spec.ts`) pass.

- [ ] **Step 6: Manual QA**

Run the app (`cd app && npm run tauri dev`, or the project's usual dev command) and check, per the spec's Tests section:

- Toggle switches Board ↔ Calendar and the choice survives a reload.
- Dragging a non-recurring chip onto another day cell moves it, and the move survives a reload.
- A recurring (habit) chip is visibly non-draggable (no grab cursor, drag does nothing).
- Prev/Next chevrons and "Today" navigate correctly across a Dec → Jan rollover.
- A day with more than 3 tasks shows the "+N more" label (non-interactive).

- [ ] **Step 7: Commit**

```bash
git add app/src/routes/tasks/+page.svelte
git commit -m "feat: add Board/Calendar toggle to Task Manager"
```

---

## Self-Review Notes

- **Spec coverage:** view toggle + persistence (Task 3 Steps 1–3), `tasksByDay` with dedup (Task 1), month grid reuse from `calendarGrid` (Task 2), day cell rendering incl. dimmed/accent-ring/chips/"+N more" (Task 2), drag reschedule incl. non-recurring-only + same-day no-op (Task 2), `tasks/+page.svelte` wiring (Task 3), Vitest coverage for `tasksByDay` (Task 1), manual QA checklist (Task 3 Step 6) — all covered.
- **Out-of-scope items** (week view, interactive overflow, quick-add from cell, cross-device persistence, multi-day tasks) are deliberately absent from every task above.
- **Type consistency:** `tasksByDay(tasks: TaskSummary[], days: string[]): Map<string, TaskSummary[]>` (Task 1) matches its usage in Task 2 (`tasksByDay(tasks, grid.map(...))`). `CalendarView`'s `Props` interface (Task 2) is character-for-character the same as `KanbanBoard`'s and what Task 3 passes at both call sites.
