# Task Manager Kanban Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the Task Manager (`/tasks`) board with the goal-detail Kanban board by extending `KanbanBoard.svelte` (drag-and-drop, chevron steppers, quick-add) with Task Manager's extra needs (delete, goal/subgoal parent chip, habit pill, move-pulse), then use the one component on both pages.

**Architecture:** `KanbanBoard.svelte` gains four new/changed props (`goals`, `parentChipMode`, `onDeleteTask`, plus `goalId` becomes optional) and three new internal behaviors (delete icon, habit-specific pill instead of chevrons, move-pulse funneled through the existing `moveTask()`). The goal-detail page adds task-delete wiring it doesn't have today. The Task Manager page's bespoke board block is deleted outright and replaced with `<KanbanBoard>`, with its now-dead local helpers removed.

**Tech Stack:** SvelteKit 5 (runes), TypeScript, Tailwind, `svelte/animate` (`flip`), no component-level test harness in this repo (Vitest covers pure functions only, Playwright e2e only covers the app shell against a backend-less web build).

## Global Constraints

- No new Playwright e2e coverage — `app/e2e/shell.e2e.ts`'s own header comment establishes that `test:e2e` runs against a Tauri-backend-less web build and can't exercise CRUD flows; board mutations here are all CRUD. (Spec: `docs/superpowers/specs/2026-08-03-task-manager-kanban-parity-design.md`, Testing section.)
- No new pure-function extraction — parent-chip and habit-pill branching are template-level per the approved spec; existing `app/src/lib/kanban.spec.ts` coverage of `groupByStatus`/`taskColumn` is untouched and sufficient.
- Every task ends with `npm run check` (svelte-check) passing and `npm run test:unit -- --run` green, run from `app/`.
- Preserve the entrance-stagger (`mp-enter` + `--mp-delay`) card-arrival animation currently on `/tasks` — it is being carried into the shared component, not dropped, even though the approved spec's "Move pulse" section only calls out the pulse explicitly.
- Accepted trade-off, not a bug: today, ticking a habit from the Streaks section above the `/tasks` board also pulses the matching card in the board below (both currently read the same page-level `justMovedId` state). Once the board owns its pulse state privately, that cross-component highlight is lost — `toggleToday()` on the page no longer touches any pulse state. This was not part of the approved spec and is not being replicated (would require lifting board state back up, which is exactly the coupling this plan removes).

---

### Task 1: Extend `KanbanBoard.svelte` and wire it into the goal-detail page

**Files:**
- Modify: `app/src/lib/components/KanbanBoard.svelte` (full rewrite of the `<script>` block and template)
- Modify: `app/src/routes/goals/[id]/+page.svelte:5-15` (import), `:39` (state), `:107-118` (add `removeTask`), `:329-336` (component usage), `:381` (add second `ConfirmDialog`)

**Interfaces:**
- Consumes: `groupByStatus` from `$lib/kanban` (unchanged, already exists), `TaskSummary`/`GoalSummary`/`SubgoalDetail`/`TaskStatus` from `$lib/api` (unchanged, already exist), `stagger`/`motion` from `$lib/motion` (unchanged, already exist).
- Produces: `KanbanBoard.svelte`'s new prop surface, consumed by Task 2:
  ```ts
  interface Props {
  	goalId?: number | null; // omitted/null -> quick-add creates a goal-less task
  	tasks: TaskSummary[];
  	subgoals: SubgoalDetail[];
  	goals?: GoalSummary[]; // only read when parentChipMode is 'goal-and-subgoal'
  	parentChipMode: 'subgoal-only' | 'goal-and-subgoal';
  	onMutated: () => Promise<void> | void;
  	onError: (error: unknown) => void;
  	onEditTask: (task: TaskSummary) => void;
  	onDeleteTask: (task: TaskSummary) => void;
  }
  ```

- [ ] **Step 1: Rewrite `KanbanBoard.svelte`**

Replace the entire file content with:

```svelte
<!-- app/src/lib/components/KanbanBoard.svelte -->
<script lang="ts">
	import { flip } from 'svelte/animate';

	import {
		createTask,
		RECURRENCE_LABELS,
		setTaskCompletion,
		setTaskStatus,
		TASK_STATUS_LABELS,
		TASK_STATUSES,
		type GoalSummary,
		type SubgoalDetail,
		type TaskStatus,
		type TaskSummary
	} from '$lib/api';
	import { dueLabel, dueTone } from '$lib/format';
	import { groupByStatus } from '$lib/kanban';
	import { motion, stagger } from '$lib/motion';
	import Icon from './Icon.svelte';
	import { button, field, sectionHeading } from './ui';

	interface Props {
		goalId?: number | null;
		tasks: TaskSummary[];
		subgoals: SubgoalDetail[];
		goals?: GoalSummary[];
		parentChipMode: 'subgoal-only' | 'goal-and-subgoal';
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
		onEditTask: (task: TaskSummary) => void;
		onDeleteTask: (task: TaskSummary) => void;
	}

	let {
		goalId = null,
		tasks,
		subgoals,
		goals = [],
		parentChipMode,
		onMutated,
		onError,
		onEditTask,
		onDeleteTask
	}: Props = $props();

	let busy = $state(false);
	let dragOverStatus = $state<TaskStatus | null>(null);
	/** Set for a moment after a card changes column, to play the move pulse. */
	let justMovedId = $state<number | null>(null);
	let moveTimer: ReturnType<typeof setTimeout>;
	let newTaskTitles = $state<Record<TaskStatus, string>>({
		todo: '',
		in_progress: '',
		done: ''
	});

	const subgoalNames = $derived(new Map(subgoals.map((s) => [s.id, s.title])));
	const goalTitles = $derived(new Map(goals.map((g) => [g.id, g.title])));
	const columns = $derived(groupByStatus(tasks));

	/**
	 * `'subgoal-only'` (goal-detail page, already scoped to one goal): the
	 * subgoal name alone, omitted for direct tasks. `'goal-and-subgoal'` (Task
	 * Manager, no goal in scope): "Goal / Subgoal", "Goal", or nothing.
	 */
	function parentLabel(task: TaskSummary): string | null {
		const subgoalName = task.subgoalId ? (subgoalNames.get(task.subgoalId) ?? null) : null;
		if (parentChipMode === 'subgoal-only') return subgoalName;

		const goalTitle = task.goalId ? (goalTitles.get(task.goalId) ?? null) : null;
		if (goalTitle && subgoalName) return `${goalTitle} / ${subgoalName}`;
		return subgoalName ?? goalTitle;
	}

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

	/**
	 * A habit (recurrence set) has no lasting `status` — see `taskColumn()` in
	 * `$lib/kanban` and the rule at `TaskRow.svelte:36-38`. Ticking it logs today's
	 * completion instead of writing a status, so the streak/heatmap stay in sync.
	 * This is the single funnel point for every column change (drag, stepper,
	 * habit pill), so the move-pulse fires uniformly no matter which triggered it.
	 */
	function moveTask(task: TaskSummary, status: TaskStatus) {
		justMovedId = task.id;
		clearTimeout(moveTimer);
		moveTimer = setTimeout(() => (justMovedId = null), 500);

		if (task.recurrence) {
			if (status === 'in_progress') return; // a habit has no in-progress state
			return run(() => setTaskCompletion(task.id, status === 'done'));
		}
		return run(() => setTaskStatus(task.id, status));
	}

	/**
	 * One column left/right; a no-op past either edge. A habit's raw `status` never
	 * moves, so we step from its *displayed* column and skip straight between
	 * todo/done — it has no in-progress state.
	 */
	function step(task: TaskSummary, direction: 1 | -1) {
		if (task.recurrence) {
			if (!task.expectedToday) return;
			return moveTask(task, direction === 1 ? 'done' : 'todo');
		}
		const next = TASK_STATUSES[TASK_STATUSES.indexOf(task.status) + direction];
		if (next) moveTask(task, next);
	}

	function dragStart(event: DragEvent, task: TaskSummary) {
		event.dataTransfer?.setData('text/plain', String(task.id));
	}

	function dragOver(event: DragEvent, status: TaskStatus) {
		event.preventDefault();
		dragOverStatus = status;
	}

	function dragLeave(status: TaskStatus) {
		if (dragOverStatus === status) dragOverStatus = null;
	}

	function drop(event: DragEvent, status: TaskStatus) {
		event.preventDefault();
		dragOverStatus = null;
		if (busy) return;
		const id = Number(event.dataTransfer?.getData('text/plain'));
		const task = tasks.find((t) => t.id === id);
		if (task) moveTask(task, status);
	}

	async function quickAdd(event: SubmitEvent, status: TaskStatus) {
		event.preventDefault();
		const title = newTaskTitles[status].trim();
		if (!title) return;

		newTaskTitles[status] = '';
		await run(async () => {
			const created = await createTask({
				title,
				dueDate: null,
				goalId,
				subgoalId: null,
				recurrence: null
			});
			if (status !== 'todo') await setTaskStatus(created.id, status);
		});
	}
</script>

<div class="grid gap-4 md:grid-cols-3">
	{#each TASK_STATUSES as status (status)}
		<section
			class="flex min-h-50 flex-col gap-2.5 rounded-card border p-3.5 transition-colors {dragOverStatus ===
			status
				? 'border-accent bg-accent/5'
				: 'border-subtle bg-surface'}"
			ondragover={(event) => dragOver(event, status)}
			ondragleave={() => dragLeave(status)}
			ondrop={(event) => drop(event, status)}
		>
			<h2 class="flex justify-between {sectionHeading} text-xs">
				<span>{TASK_STATUS_LABELS[status]}</span>
				<span class="tabular-nums">{columns[status].length}</span>
			</h2>

			{#each columns[status] as task, index (task.id)}
				{@const parent = parentLabel(task)}
				{@const inert = busy || Boolean(task.recurrence && !task.expectedToday)}
				<div
					class="group rounded-card border p-3.5 transition-shadow {justMovedId === task.id
						? 'mp-pulse border-accent bg-background ring-3 ring-accent/30'
						: 'mp-enter border-subtle bg-background'}"
					style="--mp-delay:{stagger(index, 30)}"
					draggable={!inert}
					ondragstart={(event) => dragStart(event, task)}
					animate:flip={{ duration: motion(200) }}
				>
					<div class="flex items-start gap-2">
						<button
							type="button"
							class="block min-w-0 flex-1 text-left text-sm font-semibold"
							onclick={() => onEditTask(task)}
						>
							{task.title}
						</button>

						<div
							class="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
						>
							<button type="button" class={button.bare} onclick={() => onEditTask(task)}>
								<Icon name="edit" size={13} label="Edit {task.title}" />
							</button>
							<button
								type="button"
								class={button.bare}
								disabled={busy}
								onclick={() => onDeleteTask(task)}
							>
								<Icon name="trash" size={13} label="Delete {task.title}" />
							</button>
						</div>
					</div>

					<div class="mt-2 flex flex-wrap items-center gap-2">
						{#if parent}
							<span
								class="max-w-32 truncate rounded-full bg-accent/15 px-2.5 py-0.5 text-2xs font-semibold text-accent"
							>
								{parent}
							</span>
						{/if}
						{#if task.recurrence}
							<span
								class="flex shrink-0 items-center gap-1 rounded-full bg-accent-secondary/15 px-2 py-0.5 text-2xs font-semibold text-accent-secondary"
							>
								<Icon name="flame" size={12} />
								{RECURRENCE_LABELS[task.recurrence]}
							</span>
						{/if}
						{#if task.dueDate}
							<span
								class="shrink-0 text-2xs {dueTone(task.dueDate) === 'overdue'
									? 'text-warn'
									: 'text-muted'}"
							>
								{dueLabel(task.dueDate)}
							</span>
						{/if}
					</div>

					{#if task.recurrence}
						{@const label = !task.expectedToday
							? 'Not due today'
							: task.completedToday
								? 'Done today'
								: 'Do today'}
						{@const title = !task.expectedToday
							? 'No occurrence expected today'
							: task.completedToday
								? 'Undo today'
								: 'Mark done for today'}
						<div class="mt-2 flex justify-end">
							<button
								type="button"
								class="shrink-0 rounded-full px-2.5 py-1 text-2xs font-semibold transition-colors disabled:opacity-50 {task.expectedToday &&
								task.completedToday
									? 'bg-accent-secondary/20 text-accent-secondary hover:bg-accent-secondary/30'
									: 'bg-surface-raised text-muted hover:text-content'}"
								disabled={inert}
								{title}
								onclick={() => moveTask(task, task.completedToday ? 'todo' : 'done')}
							>
								{label}
							</button>
						</div>
					{:else}
						<div class="mt-2 flex justify-end gap-1">
							{#if status !== 'todo'}
								<button
									type="button"
									class={button.bare}
									disabled={inert}
									onclick={() => step(task, -1)}
								>
									<Icon
										name="chevron-right"
										size={13}
										class="rotate-180"
										label="Move {task.title} left"
									/>
								</button>
							{/if}
							{#if status !== 'done'}
								<button
									type="button"
									class={button.bare}
									disabled={inert}
									onclick={() => step(task, 1)}
								>
									<Icon name="chevron-right" size={13} label="Move {task.title} right" />
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{/each}

			{#if columns[status].length === 0}
				<p class="px-2 py-6 text-center text-xs text-muted/70">No tasks</p>
			{/if}

			<form class="mt-auto" onsubmit={(event) => quickAdd(event, status)}>
				<input
					class="{field.dashed} w-full text-sm"
					bind:value={newTaskTitles[status]}
					placeholder="+ Add a task…"
					aria-label="New task in {TASK_STATUS_LABELS[status]}"
				/>
			</form>
		</section>
	{/each}
</div>
```

- [ ] **Step 2: Wire the goal-detail page's task-delete flow**

In `app/src/routes/goals/[id]/+page.svelte`, change the import block (currently lines 5-15) to add `deleteTask`:

```ts
import {
	createSubgoal,
	createTask,
	deleteGoal,
	deleteTask,
	GOAL_STATUS_LABELS,
	GOAL_STATUSES,
	setGoalStatus,
	TIMEFRAME_LABELS,
	type GoalStatus,
	type TaskSummary
} from '$lib/api';
```

Add a `deletingTask` state next to `editingTask` (currently line 39):

```ts
let editingTask = $state<TaskSummary | null>(null);
let deletingTask = $state<TaskSummary | null>(null);
```

Add a `removeTask` function next to `removeGoal` (currently ending at line 118), right before the `$effect` block:

```ts
async function removeTask() {
	const task = deletingTask;
	if (!task) return;
	deletingTask = null;
	await run(() => deleteTask(task.id));
}
```

- [ ] **Step 3: Pass the new props into the goal page's `<KanbanBoard>`**

Replace the existing usage (currently lines 329-336):

```svelte
<KanbanBoard
	goalId={goal.id}
	tasks={boardTasks}
	subgoals={goal.subgoals}
	parentChipMode="subgoal-only"
	onMutated={invalidateAll}
	onError={(error) => (actionError = error)}
	onEditTask={editTask}
	onDeleteTask={(task) => (deletingTask = task)}
/>
```

- [ ] **Step 4: Add the task-delete confirm dialog**

Immediately after the existing `</ConfirmDialog>` (currently line 381, the goal-delete dialog) and before the closing `{/if}`, add:

```svelte
	<ConfirmDialog
		open={deletingTask !== null}
		title="Delete “{deletingTask?.title ?? ''}”?"
		body="The task is removed from the board. This cannot be undone."
		{busy}
		onConfirm={removeTask}
		onCancel={() => (deletingTask = null)}
	/>
```

- [ ] **Step 5: Type-check and unit-test**

Run from `app/`:
```
npm run check
npm run test:unit -- --run
```
Expected: both pass with no errors (no new pure logic was added, so no new Vitest cases; `check` must be clean — this is the change's only automated gate).

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open a goal's detail page, switch to Kanban view, and confirm:
- Existing behavior unchanged: drag a card between columns, use the chevron steppers, quick-add a task in a column, click a card title to open the edit drawer.
- New: hover a card → trash icon appears next to the pencil icon; clicking it opens a confirm dialog; confirming removes the task and it disappears from the board.
- New: a card that just moved (drag, stepper, or — if the goal has a habit task — the pill) shows a brief accent-ring pulse.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/components/KanbanBoard.svelte "app/src/routes/goals/[id]/+page.svelte"
git commit -m "feat: extend KanbanBoard with delete, parent-chip modes, and habit pill; wire task delete into the goal page"
```

---

### Task 2: Replace the Task Manager's bespoke board with `<KanbanBoard>`

**Files:**
- Modify: `app/src/routes/tasks/+page.svelte` (script block and the board section of the template)

**Interfaces:**
- Consumes: `KanbanBoard.svelte`'s prop surface from Task 1 (`goals`, `parentChipMode`, `onDeleteTask`, optional `goalId`).
- Produces: nothing consumed by a later task — this is the last code task.

- [ ] **Step 1: Replace the script block**

Replace the entire `<script lang="ts">...</script>` block in `app/src/routes/tasks/+page.svelte` with:

```svelte
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { deleteTask, setTaskCompletion, type TaskSummary } from '$lib/api';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import KanbanBoard from '$lib/components/KanbanBoard.svelte';
	import StreakCard from '$lib/components/StreakCard.svelte';
	import TaskDrawer from '$lib/components/TaskDrawer.svelte';
	import { button, sectionHeading } from '$lib/components/ui';

	let { data } = $props();

	let drawerOpen = $state(false);
	let editingTask = $state<TaskSummary | null>(null);
	let deletingTask = $state<TaskSummary | null>(null);
	let busy = $state(false);
	let actionError = $state<unknown>(null);

	async function run(action: () => Promise<unknown>) {
		busy = true;
		actionError = null;
		try {
			await action();
			await invalidateAll();
		} catch (error) {
			actionError = error;
		} finally {
			busy = false;
		}
	}

	async function toggleToday(task: { id: number }, done: boolean) {
		await run(() => setTaskCompletion(task.id, done));
	}

	async function removeTask() {
		const task = deletingTask;
		if (!task) return;
		deletingTask = null;
		await run(() => deleteTask(task.id));
	}

	function edit(task: TaskSummary) {
		editingTask = task;
		drawerOpen = true;
	}
</script>
```

This removes (now dead, superseded by the shared board): `parentLabel`, `goalTitles`, `subgoalTitles`, the local `taskColumn` (an exact duplicate of `$lib/kanban`'s exported one — the doc comment on that exported copy already flagged the duplication), `columns`, `STATUS_PILL_CLASSES`, `pill`, `advance`, `justMovedId`, `moveTimer` (see Global Constraints for the accepted cross-component pulse trade-off this causes).

- [ ] **Step 2: Replace the board markup**

Replace the entire board block:

```svelte
<div class="grid gap-4 md:grid-cols-3">
	{#each columns as column (column.status)}
	...
	{/each}
</div>
```

(the full section between the Streaks `{/if}` and the `<TaskDrawer` tag) with:

```svelte
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
```

- [ ] **Step 3: Type-check and unit-test**

Run from `app/`:
```
npm run check
npm run test:unit -- --run
```
Expected: both pass with no errors.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open `/tasks`, and confirm:
- Board renders three columns with the same tasks as before, each card now showing a goal/subgoal chip (e.g. "Goal / Subgoal") where the old board showed one.
- Drag a card between columns; it persists after reload.
- Chevron steppers move a non-habit card one column at a time, disabled at the edges.
- A habit card shows the labeled pill (`Do today` / `Done today` / `Not due today`) instead of chevrons, and toggling it updates the Streaks section above.
- Quick-add in a column creates a standalone task (no goal) already in that column.
- Hover a card → pencil and trash icons appear; trash opens the existing confirm dialog and deletes on confirm.
- Click a card's title → the edit drawer opens (previously only the pencil icon did this).

- [ ] **Step 5: Commit**

```bash
git add app/src/routes/tasks/+page.svelte
git commit -m "feat: replace Task Manager's bespoke board with the shared KanbanBoard"
```

---

### Task 3: Full verification pass

**Files:** none (verification only, no code changes).

- [ ] **Step 1: Run the full test suite**

From `app/`:
```
npm run test:unit -- --run
npm run check
npm run lint
```
Expected: all three pass. (`test:e2e` is intentionally not run for this change — see Global Constraints.)

- [ ] **Step 2: Cross-page smoke test**

With `npm run dev` running, repeat the manual verification checklists from Task 1 Step 6 and Task 2 Step 4 back to back in one session, confirming neither page regressed the other (e.g. deleting a task from one goal's board doesn't affect `/tasks`' list on reload, and vice versa).

No commit for this task — it's verification of Tasks 1-2's already-committed work.
