# Goal Kanban View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Goal's tasks (direct + all subgoal tasks) be viewed as a drag-and-drop Kanban board, toggled via a segmented control next to the existing flat List view, per `docs/superpowers/specs/2026-08-03-goal-kanban-view-design.md`.

**Architecture:** Pure view layer, no schema/backend change. A new `KanbanBoard.svelte` component renders `TASK_STATUSES` as three columns over a client-computed task set; column moves and quick-add both funnel through the existing `setTaskStatus`/`createTask` API calls already used elsewhere on the page. The List/Kanban choice is a per-goal `localStorage` flag, read/written directly (no store, no backend field).

**Tech Stack:** SvelteKit 5 (runes), TypeScript, Tailwind, Vitest (node-environment `.spec.ts` only — no component-test harness exists in this repo).

## Global Constraints

- Scope is `app/src/routes/goals/[id]/+page.svelte`, its loader, and one new component — Task Manager (`/tasks`) already renders its own independent three-column status board and is untouched by this feature; there's no shared code between the two.
- No schema change, no new backend query. Board task set is computed client-side from data already loaded.
- View toggle persists in `localStorage` under `mp-goal-view-{goalId}`, client-side only, no backend field.
- Column moves and quick-add both terminate in `setTaskStatus(id, status)` → `onMutated()`; on failure, the existing `actionError` banner shows and the card stays put (no optimistic column move — state only changes once `invalidateAll` reconciles from the server).
- Card badges (recurrence flame, due date) reuse the exact markup/classes from `TaskRow.svelte`; clicking a card opens the existing `TaskDrawer` in edit mode.
- Out of scope (per spec): persisted card order within a column, custom/user-defined columns, cross-goal/Task-Manager Kanban view, server-side persistence of the List/Kanban toggle.

## Testing Note (read before Task 4)

The spec asks for Playwright e2e coverage of toggle persistence, drag, the keyboard stepper, and quick-add. Two things in this repo make that infeasible as written, and this plan adapts rather than writing tests that cannot pass:

1. `app/playwright.config.ts` runs against `npm run build && npm run preview` — the plain web build with **no Tauri backend**. `app/e2e/shell.e2e.ts` documents this directly: hitting `/goals` in that build shows the "Backend not running" error banner, not real goal data. A goal detail page with tasks to drag around cannot render at all under this harness — this is a pre-existing, repo-wide gap ("A Tauri-driven e2e harness that exercises the real backend has not landed yet"), not something introduced or fixable by this feature.
2. `vite.config.ts` only configures a `server` (node-environment) Vitest project and explicitly excludes `*.svelte.{test,spec}.ts` — there is no component-test setup (no `@testing-library/svelte`, no jsdom project) to unit-test `KanbanBoard.svelte` in isolation either.

So: Task 1 gives the one piece of this feature that **is** honestly testable today — the pure `groupByStatus` grouping logic, as a `.spec.ts` following the existing `app/src/lib/format.spec.ts` pattern. Task 4 replaces the Playwright suite with a manual verification pass in the real running app (`npm run tauri dev`), which is the only way to exercise real CRUD in this codebase right now (matches how `shell.e2e.ts` itself limits its own CRUD-adjacent coverage). Flag to the user if a real Tauri e2e harness lands later — this suite should move there.

---

### Task 1: `groupByStatus` grouping logic

**Files:**
- Create: `app/src/lib/kanban.ts`
- Test: `app/src/lib/kanban.spec.ts`

**Interfaces:**
- Produces: `groupByStatus(tasks: TaskSummary[]): Record<TaskStatus, TaskSummary[]>` — consumed by `KanbanBoard.svelte` in Task 2.

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/kanban.spec.ts
import { describe, expect, it } from 'vitest';

import type { TaskSummary } from './api';
import { groupByStatus } from './kanban';

function task(overrides: Partial<TaskSummary> & Pick<TaskSummary, 'id' | 'status'>): TaskSummary {
	return {
		title: 'Task',
		dueDate: null,
		goalId: null,
		subgoalId: null,
		recurrence: null,
		createdAt: '2026-08-01T00:00:00Z',
		updatedAt: '2026-08-01T00:00:00Z',
		completedToday: false,
		expectedToday: true,
		...overrides
	};
}

describe('groupByStatus', () => {
	it('buckets tasks by status, preserving input order within a bucket', () => {
		const tasks = [
			task({ id: 1, status: 'todo' }),
			task({ id: 2, status: 'in_progress' }),
			task({ id: 3, status: 'done' }),
			task({ id: 4, status: 'todo' })
		];

		const grouped = groupByStatus(tasks);

		expect(grouped.todo.map((t) => t.id)).toEqual([1, 4]);
		expect(grouped.in_progress.map((t) => t.id)).toEqual([2]);
		expect(grouped.done.map((t) => t.id)).toEqual([3]);
	});

	it('gives every status an empty array when no tasks match', () => {
		const grouped = groupByStatus([]);

		expect(grouped.todo).toEqual([]);
		expect(grouped.in_progress).toEqual([]);
		expect(grouped.done).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/lib/kanban.spec.ts`
Expected: FAIL — `Cannot find module './kanban'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/lib/kanban.ts
import { TASK_STATUSES, type TaskStatus, type TaskSummary } from './api';

/** Buckets a flat task list into the three board columns, in input order. */
export function groupByStatus(tasks: TaskSummary[]): Record<TaskStatus, TaskSummary[]> {
	const grouped = Object.fromEntries(
		TASK_STATUSES.map((status) => [status, [] as TaskSummary[]])
	) as Record<TaskStatus, TaskSummary[]>;

	for (const task of tasks) {
		grouped[task.status].push(task);
	}

	return grouped;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/lib/kanban.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/kanban.ts app/src/lib/kanban.spec.ts
git commit -m "feat: add groupByStatus for the goal Kanban board"
```

---

### Task 2: `KanbanBoard.svelte` component

**Files:**
- Create: `app/src/lib/components/KanbanBoard.svelte`

**Interfaces:**
- Consumes: `groupByStatus(tasks: TaskSummary[]): Record<TaskStatus, TaskSummary[]>` (Task 1); `TASK_STATUSES: TaskStatus[]`, `TASK_STATUS_LABELS: Record<TaskStatus, string>`, `RECURRENCE_LABELS`, `createTask(input: TaskInput): Promise<Task>`, `setTaskStatus(id: number, status: TaskStatus): Promise<Task>` from `$lib/api`; `dueLabel`, `dueTone` from `$lib/format`; `motion` from `$lib/motion`; `button`, `field`, `sectionHeading` from `./ui`; `Icon` from `./Icon.svelte`.
- Produces: default export `KanbanBoard.svelte` with

  ```ts
  interface Props {
  	/** The goal this board belongs to — quick-add creates a direct task on it,
  	 * same as the existing "+ Add a task…" form it replaces in Kanban view. */
  	goalId: number;
  	tasks: TaskSummary[];
  	subgoals: SubgoalDetail[]; // for subgoal-name chip lookup by id
  	onMutated: () => Promise<void> | void;
  	onError: (error: unknown) => void;
  	/** TaskDrawer lives at the page level (it needs the full cross-goal
  	 * goals/subgoals lists for parent reassignment, which this board doesn't
  	 * have) — this hands the clicked task up to open it, same shape as
  	 * `edit(task)` in `app/src/routes/tasks/+page.svelte`. */
  	onEditTask: (task: TaskSummary) => void;
  }
  ```

  consumed by `app/src/routes/goals/[id]/+page.svelte` in Task 3.

  Note: the design doc's Props block lists only `tasks`, `subgoals`, `onMutated`, `onError`. `goalId` and `onEditTask` are added here because the spec's own behavior needs them — quick-add must attach the new task to *this* goal (`createTask` requires a `goalId` or `subgoalId`), and something has to carry "open this task's editor" up to wherever `TaskDrawer` actually renders (the page, per Task 3 — `TaskDrawer` needs the full `goals`/`subgoals` lists this component doesn't hold).

- [ ] **Step 1: Write the component**

```svelte
<!-- app/src/lib/components/KanbanBoard.svelte -->
<script lang="ts">
	import { flip } from 'svelte/animate';

	import {
		createTask,
		RECURRENCE_LABELS,
		setTaskStatus,
		TASK_STATUS_LABELS,
		TASK_STATUSES,
		type SubgoalDetail,
		type TaskStatus,
		type TaskSummary
	} from '$lib/api';
	import { dueLabel, dueTone } from '$lib/format';
	import { groupByStatus } from '$lib/kanban';
	import { motion } from '$lib/motion';
	import Icon from './Icon.svelte';
	import { button, field, sectionHeading } from './ui';

	interface Props {
		goalId: number;
		tasks: TaskSummary[];
		subgoals: SubgoalDetail[];
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
		onEditTask: (task: TaskSummary) => void;
	}

	let { goalId, tasks, subgoals, onMutated, onError, onEditTask }: Props = $props();

	let busy = $state(false);
	let dragOverStatus = $state<TaskStatus | null>(null);
	let newTaskTitles = $state<Record<TaskStatus, string>>({
		todo: '',
		in_progress: '',
		done: ''
	});

	const subgoalNames = $derived(new Map(subgoals.map((s) => [s.id, s.title])));
	const columns = $derived(groupByStatus(tasks));

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

	function moveTask(taskId: number, status: TaskStatus) {
		return run(() => setTaskStatus(taskId, status));
	}

	/** One column left/right; a no-op past either edge. */
	function step(task: TaskSummary, direction: 1 | -1) {
		const next = TASK_STATUSES[TASK_STATUSES.indexOf(task.status) + direction];
		if (next) moveTask(task.id, next);
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
		const id = Number(event.dataTransfer?.getData('text/plain'));
		if (Number.isInteger(id)) moveTask(id, status);
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

			{#each columns[status] as task (task.id)}
				{@const subgoalName = task.subgoalId ? subgoalNames.get(task.subgoalId) : null}
				<div
					class="group rounded-card border border-subtle bg-background p-3.5"
					draggable="true"
					ondragstart={(event) => dragStart(event, task)}
					animate:flip={{ duration: motion(200) }}
				>
					<button
						type="button"
						class="block w-full text-left text-sm font-semibold"
						onclick={() => onEditTask(task)}
					>
						{task.title}
					</button>

					<div class="mt-2 flex flex-wrap items-center gap-2">
						{#if subgoalName}
							<span
								class="max-w-32 truncate rounded-full bg-accent/15 px-2.5 py-0.5 text-2xs font-semibold text-accent"
							>
								{subgoalName}
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

					<div class="mt-2 flex justify-end gap-1">
						{#if status !== 'todo'}
							<button
								type="button"
								class={button.bare}
								disabled={busy}
								onclick={() => step(task, -1)}
							>
								<Icon name="chevron-right" size={13} class="rotate-180" label="Move {task.title} left" />
							</button>
						{/if}
						{#if status !== 'done'}
							<button
								type="button"
								class={button.bare}
								disabled={busy}
								onclick={() => step(task, 1)}
							>
								<Icon name="chevron-right" size={13} label="Move {task.title} right" />
							</button>
						{/if}
					</div>
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

- [ ] **Step 2: Typecheck**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json`
Expected: no new errors from `KanbanBoard.svelte` (it isn't imported anywhere yet, so this only catches syntax/type mistakes inside the file itself).

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/components/KanbanBoard.svelte
git commit -m "feat: add KanbanBoard component for the goal detail page"
```

---

### Task 3: Wire the Kanban view into the goal detail page

**Files:**
- Modify: `app/src/routes/goals/[id]/+page.ts`
- Modify: `app/src/routes/goals/[id]/+page.svelte`

**Interfaces:**
- Consumes: `KanbanBoard.svelte` Props from Task 2; existing `TaskDrawer.svelte` (`goals: GoalSummary[]`, `subgoals: Subgoal[]`, `task: Task | null`, `onClose`, `onSaved`); `listGoals`, `listSubgoals` from `$lib/api` (already used by `app/src/routes/tasks/+page.ts` — same shape reused here).
- Produces: loader now returns `{ goal, categories, goals, subgoals, error }`.

- [ ] **Step 1: Extend the loader**

```ts
// app/src/routes/goals/[id]/+page.ts
import { error as httpError } from '@sveltejs/kit';

import { AppError, getGoal, listCategories, listGoals, listSubgoals } from '$lib/api';

export const load = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) httpError(404, 'Not a goal id');

	try {
		const [goal, categories, goals, subgoals] = await Promise.all([
			getGoal(id),
			listCategories(),
			listGoals(),
			listSubgoals()
		]);
		return { goal, categories, goals, subgoals, error: null };
	} catch (raw) {
		// A goal that does not exist is a genuine 404; anything else is shown
		// inline so the user keeps the page and its navigation.
		const failure = AppError.from(raw);
		if (failure.kind === 'not_found') httpError(404, failure.message);
		return { goal: null, categories: [], goals: [], subgoals: [], error: raw };
	}
};
```

- [ ] **Step 2: Add view-toggle state and TaskDrawer wiring to the script block**

In `app/src/routes/goals/[id]/+page.svelte`, add to the imports:

```ts
import { browser } from '$app/environment';
import KanbanBoard from '$lib/components/KanbanBoard.svelte';
import TaskDrawer from '$lib/components/TaskDrawer.svelte';
import type { TaskSummary } from '$lib/api';
```

Add alongside the existing `$state` declarations:

```ts
let view = $state<'list' | 'kanban'>('list');
let editingTask = $state<TaskSummary | null>(null);
let drawerOpen = $state(false);
```

Add alongside the existing `$derived` declarations:

```ts
const boardTasks = $derived(
	data.goal
		? [...data.goal.directTasks, ...data.goal.subgoals.flatMap((s) => s.tasks)]
		: []
);
```

Add near `changeStatus`/`removeGoal`:

```ts
// Per-goal display preference only — not domain data, so it never touches
// the backend. Re-reads on every goal id change, since this page is reused
// across client-side navigation between goals.
$effect(() => {
	const id = data.goal?.id;
	if (!browser || id === undefined) return;
	const stored = localStorage.getItem(`mp-goal-view-${id}`);
	view = stored === 'kanban' ? 'kanban' : 'list';
});

function setView(next: 'list' | 'kanban') {
	view = next;
	if (browser && data.goal) localStorage.setItem(`mp-goal-view-${data.goal.id}`, next);
}

function editTask(task: TaskSummary) {
	editingTask = task;
	drawerOpen = true;
}
```

- [ ] **Step 3: Add the segmented toggle and swap the Subgoals/Direct-tasks block for the board**

Replace this line:

```svelte
		<div>
			<section class="mb-8">
				<h2 class="{sectionHeading} mb-3.5">Subgoals</h2>
```

with (note the added toggle and the `{#if view === 'list'}` wrapping the two existing `<section>`s):

```svelte
		<div>
			<div class="mb-3.5 flex gap-1.5">
				<button
					type="button"
					class={segment(view === 'list')}
					aria-pressed={view === 'list'}
					onclick={() => setView('list')}
				>
					List
				</button>
				<button
					type="button"
					class={segment(view === 'kanban')}
					aria-pressed={view === 'kanban'}
					onclick={() => setView('kanban')}
				>
					Kanban
				</button>
			</div>

			{#if view === 'list'}
			<section class="mb-8">
				<h2 class="{sectionHeading} mb-3.5">Subgoals</h2>
```

And close the new `{#if}` right after the existing Direct-tasks `</section>`, adding the `{:else}` branch, immediately before the closing `</div>` of this column:

```svelte
				<form onsubmit={addDirectTask}>
					<input
						class="{field.dashed} w-full"
						bind:value={newTaskTitle}
						placeholder="+ Add a task…"
						aria-label="New direct task"
					/>
				</form>
			</section>
			{:else}
				<KanbanBoard
					goalId={goal.id}
					tasks={boardTasks}
					subgoals={goal.subgoals}
					onMutated={invalidateAll}
					onError={(error) => (actionError = error)}
					onEditTask={editTask}
				/>
			{/if}
		</div>
```

- [ ] **Step 4: Render `TaskDrawer`**

Right after the existing `<GoalDrawer ... />` block (before `<ConfirmDialog ...>`), add:

```svelte
	<TaskDrawer
		open={drawerOpen}
		goals={data.goals}
		subgoals={data.subgoals}
		task={editingTask}
		onClose={() => (drawerOpen = false)}
		onSaved={invalidateAll}
	/>
```

- [ ] **Step 5: Typecheck and run the existing suite**

Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json`
Expected: no errors.

Run: `cd app && npx vitest run --project server`
Expected: all existing `.spec.ts` files still pass (this feature touches no repo/db logic, so nothing here should change).

- [ ] **Step 6: Commit**

```bash
git add app/src/routes/goals/[id]/+page.ts app/src/routes/goals/[id]/+page.svelte
git commit -m "feat: add List/Kanban toggle to the goal detail page"
```

---

### Task 4: Manual verification (replaces the spec's Playwright suite — see Testing Note)

No new files. This is a manual pass against the real app, per session convention for UI changes and per the Testing Note above (no backend in the Playwright preview build, no component-test harness for `.svelte` files).

- [ ] **Step 1: Start the real app**

Run: `cd app && npm run tauri dev`
(Or use the `run` skill if available, which knows this project's launch pattern.)

- [ ] **Step 2: Exercise the golden path**

Open a goal with at least one direct task and one subgoal with tasks. Confirm:
- The **List | Kanban** segmented control appears above the Subgoals section, defaulting to List.
- Switching to Kanban shows three columns (To do / In progress / Done) with correct counts, direct tasks and subgoal tasks merged, subgoal-owned cards showing their subgoal-name chip.
- Reloading the page keeps the last-selected view (localStorage key `mp-goal-view-<id>`).
- Switching to a *different* goal defaults back to List (or to whatever that goal's own key holds), confirming the effect re-reads per goal id.

- [ ] **Step 3: Exercise column-change paths**

- Drag a card to another column; confirm its status updates and survives a reload.
- Use the `‹`/`›` stepper on a card; confirm it steps one column, and that To Do has no `‹` and Done has no `›`.
- Quick-add a task in the "In Progress" column; confirm it's created and lands in that column (not To Do) after the mutation completes.

- [ ] **Step 4: Exercise the edit path and failure path**

- Click a Kanban card; confirm `TaskDrawer` opens in edit mode with the right title/fields, and that its parent dropdown offers every goal/subgoal in the app (not just this goal's).
- Stop the backend (or force an error) and retry a drag/stepper move; confirm the `actionError` banner appears and the card stays in its original column (no optimistic move).

- [ ] **Step 5: Check reduced motion**

With the OS "reduce motion" setting on, confirm card moves no longer animate (via `motion(200)` collapsing to 0), matching the rest of the app.

No commit for this task — it's verification only. If any step fails, fix the underlying task and re-run from Step 1.
