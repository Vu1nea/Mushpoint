# Dashboard Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Dashboard screen (phase 7 of `docs/plans/goal_tracker_plan.md`) — a bento-grid home page at `/` that surfaces active goals, a vision-board preview, today's tasks, streaks, an upcoming due-date feed, and a quick-add input, replacing the current `redirect(307, '/goals')` placeholder.

**Architecture:** One thin route (`src/routes/+page.ts` + `+page.svelte`) that loads six data collections in parallel via the existing `$lib/api` layer and assembles six new presentational components (`src/lib/components/Dashboard*.svelte`) into a CSS grid. All new domain logic (today's-tasks filter, upcoming-feed merge, top-streaks selection) lives in one pure module, `src/lib/dashboard.ts`, unit-tested the same way `src/lib/format.ts` and `src/lib/calendarGrid.ts` already are. No new backend/API/DB work — every data source (`listCategories`, `listGoals`, `listSubgoals`, `listTasks`, `listStreaks`, `listVisionItems`, `createIdea`, `createTask`, `createGoal`) already exists.

**Tech Stack:** SvelteKit 5 (runes), TypeScript, Tailwind v4 semantic tokens, Vitest for unit tests, `svelte-check` for type checking.

## Global Constraints

- Every new component accepts an optional `class?: string` prop, defaulted to `''` and merged onto its root element as `class="{own-base-classes} {className}"` — the exact pattern already used in `src/lib/components/Select.svelte:24,33` and `VisionImage.svelte:9,12`. This is how the route assigns bento grid-placement classes without each component knowing about grid layout.
- This codebase does **not** unit-test `.svelte` components (no `*.spec.ts` exists for any component under `src/lib/components/`) — only pure `.ts` logic modules get Vitest specs. Component tasks below are verified with `npm run check` (svelte-check, catches prop/type mismatches) rather than red/green tests. The one new pure-logic module (`src/lib/dashboard.ts`) follows full TDD.
- Reuse existing components as-is — do not fork or modify `TaskRow.svelte`, `StreakCard.svelte`, `ProgressBar.svelte`, `VisionImage.svelte`, `ErrorBanner.svelte`, `Icon.svelte`, or the `ui.ts` helpers (`button`, `chip`, `segment`, `field`, `sectionHeading`, `lift`).
- Data mutation flow: components that mutate (quick-add, task checkboxes via `TaskRow`) call `invalidateAll()` (passed down from the page as `onAdded`/`onMutated`) rather than locally splicing loaded arrays — same convention as every existing route.
- Money quote from the existing `StreakCard.svelte:10` doc comment: `onToggle` is *"Omitted on read-only surfaces, like the Phase 7 dashboard widget"* — this is a standing instruction in the codebase to reuse `StreakCard` read-only here, not build a new merged heatmap widget.
- Run `npm run format` (Prettier) before each commit if any formatting drifted — this repo enforces `npm run lint` (`prettier --check .`) as a gate.

---

## File Structure

**Create:**
- `src/lib/dashboard.ts` — pure helpers: `todaysTasks()`, `buildUpcomingFeed()`, `topStreaks()`, plus `UpcomingItem`/`UpcomingKind` types.
- `src/lib/dashboard.spec.ts` — Vitest specs for the three helpers.
- `src/lib/components/DashboardGoalsPanel.svelte` — active goals grouped by category, `ProgressBar` per goal.
- `src/lib/components/DashboardVisionPreview.svelte` — 2×2 `VisionImage` mosaic, links to `/vision-board`.
- `src/lib/components/DashboardTasksToday.svelte` — today's tasks as a `TaskRow` checklist.
- `src/lib/components/DashboardStreaks.svelte` — top streaks, read-only `StreakCard` grid.
- `src/lib/components/DashboardUpcoming.svelte` — merged goal/subgoal/task due-date feed with overdue styling.
- `src/lib/components/DashboardQuickAdd.svelte` — idea/task/goal segmented quick-add.

**Modify:**
- `src/routes/+page.ts` — replace `redirect(307, '/goals')` with a real parallel `load()`.
- `src/routes/+page.svelte` — replace with the bento-grid assembly of the six components above (currently this file doesn't meaningfully exist beyond the redirect target — `/goals` is home today).
- `src/routes/+layout.svelte` — add `{ href: '/', label: 'Dashboard', icon: 'dashboard' }` as the first `NAV` entry (`src/routes/+layout.svelte:19-25`); delete the now-stale comment at lines 14-18 referencing "Dashboard (phase 7)".

---

### Task 1: `src/lib/dashboard.ts` — pure dashboard logic

**Files:**
- Create: `src/lib/dashboard.ts`
- Test: `src/lib/dashboard.spec.ts`

**Interfaces:**
- Consumes: `GoalSummary`, `Subgoal`, `TaskSummary`, `StreakCard` from `$lib/api` (re-exported from `$lib/api/types`); `daysUntil` from `$lib/format.ts`.
- Produces (for Tasks 4, 5, 6 to consume):
  ```ts
  export type UpcomingKind = 'goal' | 'subgoal' | 'task';

  export interface UpcomingItem {
    kind: UpcomingKind;
    id: number;
    title: string;
    dueDate: string; // never null — already filtered
    href: string | null; // null when there's nowhere to click through to
    parentLabel: string | null; // parent goal's title, for a subgoal row
  }

  export function todaysTasks(tasks: TaskSummary[], now?: Date): TaskSummary[];
  export function buildUpcomingFeed(
    goals: GoalSummary[],
    subgoals: Subgoal[],
    tasks: TaskSummary[],
    now?: Date
  ): UpcomingItem[];
  export function topStreaks(streaks: StreakCard[], limit?: number): StreakCard[];
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/dashboard.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildUpcomingFeed, todaysTasks, topStreaks } from './dashboard';
import type { GoalSummary, StreakCard, Subgoal, TaskSummary } from './api/types';

const baseTask: TaskSummary = {
  id: 1,
  title: 'Task',
  status: 'todo',
  dueDate: null,
  goalId: null,
  subgoalId: null,
  recurrence: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  completedToday: false,
  expectedToday: true
};

const baseGoal: GoalSummary = {
  id: 1,
  categoryId: null,
  title: 'Goal',
  description: null,
  timeframe: 'short',
  status: 'active',
  dueDate: null,
  motivationText: null,
  motivationImagePath: null,
  repoUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  progress: 0,
  subgoalCount: 0,
  taskCount: 0,
  fromIdea: false
};

const baseSubgoal: Subgoal = {
  id: 1,
  goalId: 1,
  title: 'Subgoal',
  dueDate: null,
  isComplete: false,
  position: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const NOW = new Date(2026, 7, 3); // Aug 3, 2026 — local, matches daysUntil's local-day math

describe('todaysTasks', () => {
  it('includes a recurring task only when expectedToday is true', () => {
    const habitDue = { ...baseTask, id: 1, recurrence: 'daily' as const, expectedToday: true };
    const habitNotDue = { ...baseTask, id: 2, recurrence: 'daily' as const, expectedToday: false };
    expect(todaysTasks([habitDue, habitNotDue], NOW)).toEqual([habitDue]);
  });

  it('includes a non-recurring task only when dueDate is exactly today, not overdue or future', () => {
    const dueToday = { ...baseTask, id: 1, dueDate: '2026-08-03' };
    const overdue = { ...baseTask, id: 2, dueDate: '2026-08-01' };
    const future = { ...baseTask, id: 3, dueDate: '2026-08-10' };
    const undated = { ...baseTask, id: 4, dueDate: null };
    expect(todaysTasks([dueToday, overdue, future, undated], NOW)).toEqual([dueToday]);
  });

  it('ignores expectedToday=true on a non-recurring task when its due date is not today', () => {
    // expectedToday is always true for non-recurring tasks (see TaskSummary doc comment) —
    // this is the trap the filter must not fall into.
    const wronglyTemptingTask = { ...baseTask, id: 1, dueDate: '2026-08-10', expectedToday: true };
    expect(todaysTasks([wronglyTemptingTask], NOW)).toEqual([]);
  });
});

describe('buildUpcomingFeed', () => {
  it('merges goals, subgoals and tasks with non-null due dates, sorted soonest/most-overdue first', () => {
    const goal = { ...baseGoal, id: 1, title: 'Goal A', dueDate: '2026-08-10' };
    const subgoal = { ...baseSubgoal, id: 1, goalId: 1, title: 'Subgoal A', dueDate: '2026-08-01' };
    const task = { ...baseTask, id: 1, goalId: 1, title: 'Task A', dueDate: '2026-08-05' };
    const feed = buildUpcomingFeed([goal], [subgoal], [task], NOW);
    expect(feed.map((item) => item.title)).toEqual(['Subgoal A', 'Task A', 'Goal A']);
  });

  it('excludes goals, subgoals and tasks with a null due date', () => {
    const goal = { ...baseGoal, id: 1, dueDate: null };
    const subgoal = { ...baseSubgoal, id: 1, goalId: 1, dueDate: null };
    const task = { ...baseTask, id: 1, dueDate: null };
    expect(buildUpcomingFeed([goal], [subgoal], [task], NOW)).toEqual([]);
  });

  it('excludes a completed task and a completed subgoal even with a due date', () => {
    const doneTask = { ...baseTask, id: 1, dueDate: '2026-08-05', status: 'done' as const };
    const doneSubgoal = { ...baseSubgoal, id: 1, goalId: 1, dueDate: '2026-08-05', isComplete: true };
    const goal = { ...baseGoal, id: 1, dueDate: '2026-08-10' };
    const feed = buildUpcomingFeed([goal], [doneSubgoal], [doneTask], NOW);
    expect(feed.map((item) => item.kind)).toEqual(['goal']);
  });

  it('excludes a subgoal whose parent goal is not in the passed-in (active) goals list', () => {
    const orphanSubgoal = { ...baseSubgoal, id: 1, goalId: 99, dueDate: '2026-08-05' };
    expect(buildUpcomingFeed([], [orphanSubgoal], [], NOW)).toEqual([]);
  });

  it('sets href to null for a standalone task with no goalId, and fills parentLabel for a subgoal', () => {
    const goal = { ...baseGoal, id: 1, title: 'Parent Goal', dueDate: null };
    const subgoal = { ...baseSubgoal, id: 1, goalId: 1, dueDate: '2026-08-05' };
    const standaloneTask = { ...baseTask, id: 1, goalId: null, dueDate: '2026-08-05' };
    const feed = buildUpcomingFeed([goal], [subgoal], [standaloneTask], NOW);
    const subgoalItem = feed.find((item) => item.kind === 'subgoal');
    const taskItem = feed.find((item) => item.kind === 'task');
    expect(subgoalItem?.parentLabel).toBe('Parent Goal');
    expect(subgoalItem?.href).toBe('/goals/1');
    expect(taskItem?.href).toBeNull();
  });
});

describe('topStreaks', () => {
  const cardWith = (current: number, longest: number, id: number): StreakCard => ({
    task: { ...baseTask, id },
    current,
    longest,
    doneToday: false,
    cells: []
  });

  it('returns the top N streaks sorted by current streak descending', () => {
    const cards = [cardWith(2, 5, 1), cardWith(9, 9, 2), cardWith(5, 5, 3)];
    expect(topStreaks(cards, 2).map((c) => c.task.id)).toEqual([2, 3]);
  });

  it('breaks ties by longest streak', () => {
    const cards = [cardWith(3, 4, 1), cardWith(3, 9, 2)];
    expect(topStreaks(cards, 2).map((c) => c.task.id)).toEqual([2, 1]);
  });

  it('defaults to a limit of 3', () => {
    const cards = [cardWith(1, 1, 1), cardWith(2, 2, 2), cardWith(3, 3, 3), cardWith(4, 4, 4)];
    expect(topStreaks(cards)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --run src/lib/dashboard.spec.ts`
Expected: FAIL — `dashboard.ts` does not exist yet (`Cannot find module './dashboard'`).

- [ ] **Step 3: Write the implementation**

Create `src/lib/dashboard.ts`:

```ts
/** Dashboard-only aggregation logic. Pure, so `now` is always passed in rather than read. */

import type { GoalSummary, StreakCard, Subgoal, TaskSummary } from './api/types';
import { daysUntil } from './format';

/** A recurring task's expectedToday is cadence-aware and correct as-is. A
 * non-recurring task's expectedToday is always true (it has no cadence to be
 * "not expected" against — see the TaskSummary doc comment), so for those the
 * only correct "is this due today" signal is the due date itself. */
export function todaysTasks(tasks: TaskSummary[], now: Date = new Date()): TaskSummary[] {
  return tasks.filter((task) =>
    task.recurrence ? task.expectedToday : daysUntil(task.dueDate, now) === 0
  );
}

export type UpcomingKind = 'goal' | 'subgoal' | 'task';

export interface UpcomingItem {
  kind: UpcomingKind;
  id: number;
  title: string;
  dueDate: string;
  href: string | null;
  parentLabel: string | null;
}

/** Merges due-dated goals, subgoals and tasks into one feed, soonest/most-overdue
 * first. `goals` is expected to already be the active-only set from the loader —
 * this keeps completed/archived goals (and any subgoal under one) out of the feed
 * without a second status filter here. */
export function buildUpcomingFeed(
  goals: GoalSummary[],
  subgoals: Subgoal[],
  tasks: TaskSummary[],
  now: Date = new Date()
): UpcomingItem[] {
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));

  const goalItems: UpcomingItem[] = goals
    .filter((goal) => goal.dueDate !== null)
    .map((goal) => ({
      kind: 'goal',
      id: goal.id,
      title: goal.title,
      dueDate: goal.dueDate as string,
      href: `/goals/${goal.id}`,
      parentLabel: null
    }));

  const subgoalItems: UpcomingItem[] = subgoals
    .filter((subgoal) => !subgoal.isComplete && subgoal.dueDate !== null && goalById.has(subgoal.goalId))
    .map((subgoal) => ({
      kind: 'subgoal',
      id: subgoal.id,
      title: subgoal.title,
      dueDate: subgoal.dueDate as string,
      href: `/goals/${subgoal.goalId}`,
      parentLabel: goalById.get(subgoal.goalId)?.title ?? null
    }));

  const taskItems: UpcomingItem[] = tasks
    .filter((task) => task.status !== 'done' && task.dueDate !== null)
    .map((task) => ({
      kind: 'task',
      id: task.id,
      title: task.title,
      dueDate: task.dueDate as string,
      href: task.goalId ? `/goals/${task.goalId}` : null,
      parentLabel: null
    }));

  return [...goalItems, ...subgoalItems, ...taskItems].sort(
    (a, b) => (daysUntil(a.dueDate, now) ?? 0) - (daysUntil(b.dueDate, now) ?? 0)
  );
}

/** Highest current streak first, ties broken by longest. */
export function topStreaks(streaks: StreakCard[], limit = 3): StreakCard[] {
  return [...streaks].sort((a, b) => b.current - a.current || b.longest - a.longest).slice(0, limit);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- --run src/lib/dashboard.spec.ts`
Expected: PASS, all 11 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard.ts src/lib/dashboard.spec.ts
git commit -m "feat: add dashboard aggregation helpers (today's tasks, upcoming feed, top streaks)"
```

---

### Task 2: `DashboardGoalsPanel.svelte`

**Files:**
- Create: `src/lib/components/DashboardGoalsPanel.svelte`

**Interfaces:**
- Consumes: `GoalSummary`, `Category` from `$lib/api`; `categoryColor` from `$lib/theme/category`; `sectionHeading`, `lift` from `$lib/components/ui`; `stagger` from `$lib/motion`; `Icon` from `./Icon.svelte`; `ProgressBar` from `./ProgressBar.svelte`.
- Produces: a component usable as `<DashboardGoalsPanel goals={data.goals} categories={data.categories} class="..." />` (consumed by Task 8).

- [ ] **Step 1: Write the component**

Create `src/lib/components/DashboardGoalsPanel.svelte`:

```svelte
<script lang="ts">
	import type { Category, GoalSummary } from '$lib/api';
	import { stagger } from '$lib/motion';
	import { categoryColor } from '$lib/theme/category';
	import Icon from './Icon.svelte';
	import ProgressBar from './ProgressBar.svelte';
	import { sectionHeading, lift } from './ui';

	interface Props {
		goals: GoalSummary[];
		categories: Category[];
		class?: string;
	}

	let { goals, categories, class: className = '' }: Props = $props();

	const grouped = $derived.by(() => {
		const byId = new Map(categories.map((category) => [category.id, category]));
		const groups = new Map<string, { color: string; goals: GoalSummary[] }>();

		for (const goal of goals) {
			const category = goal.categoryId ? byId.get(goal.categoryId) : undefined;
			const name = category?.name ?? 'Uncategorized';
			const group = groups.get(name) ?? { color: categoryColor(category?.colorToken), goals: [] };
			groups.set(name, { ...group, goals: [...group.goals, goal] });
		}
		return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
	});
</script>

<section class="flex flex-col overflow-y-auto rounded-card border border-subtle bg-surface p-4.5 {className}">
	<div class="mb-4 flex items-center justify-between gap-2">
		<h2 class={sectionHeading}>Active goals</h2>
		<a href="/goals" class="text-xs font-semibold text-muted transition-colors hover:text-content">
			View all
		</a>
	</div>

	{#if goals.length === 0}
		<p class="flex-1 py-8 text-center text-md text-muted">No active goals yet.</p>
	{:else}
		{#each grouped as [categoryName, group] (categoryName)}
			<div class="mb-5 last:mb-0">
				<div class="mb-2 flex items-center gap-2">
					<span class="size-2 rounded-full" style="background:{group.color}" aria-hidden="true"></span>
					<p class="text-xs font-semibold text-muted">{categoryName}</p>
				</div>
				<ul class="flex flex-col gap-3">
					{#each group.goals as goal, index (goal.id)}
						<li class="mp-enter" style="--mp-delay:{stagger(index)}">
							<a
								href="/goals/{goal.id}"
								class="flex items-center gap-2 rounded-control px-1 py-1 {lift}"
							>
								<span class="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-semibold">
									{#if goal.fromIdea}
										<Icon name="idea" size={12} label="Promoted from an idea" />
									{/if}
									<span class="truncate">{goal.title}</span>
								</span>
								<div class="w-32 shrink-0">
									<ProgressBar value={goal.progress} height={6} color={group.color} />
								</div>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	{/if}
</section>
```

- [ ] **Step 2: Verify with svelte-check**

Run: `npm run check`
Expected: no new errors attributable to `DashboardGoalsPanel.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/DashboardGoalsPanel.svelte
git commit -m "feat: add DashboardGoalsPanel component"
```

---

### Task 3: `DashboardVisionPreview.svelte`

**Files:**
- Create: `src/lib/components/DashboardVisionPreview.svelte`

**Interfaces:**
- Consumes: `VisionItem` from `$lib/api`; `VisionImage` from `./VisionImage.svelte`; `Icon` from `./Icon.svelte`; `sectionHeading`, `button` from `./ui`.
- Produces: `<DashboardVisionPreview items={data.visionItems} class="..." />` (consumed by Task 8). `VisionImage`'s `path` prop is non-nullable, so only items with a non-null `imagePath` are eligible for the mosaic — items that are quote-only don't fit a 2×2 image grid and are skipped here (they're still visible on the full board).

- [ ] **Step 1: Write the component**

Create `src/lib/components/DashboardVisionPreview.svelte`:

```svelte
<script lang="ts">
	import type { VisionItem } from '$lib/api';
	import Icon from './Icon.svelte';
	import VisionImage from './VisionImage.svelte';
	import { button, sectionHeading } from './ui';

	interface Props {
		items: VisionItem[];
		class?: string;
	}

	let { items, class: className = '' }: Props = $props();

	const preview = $derived(
		items.filter((item): item is VisionItem & { imagePath: string } => item.imagePath !== null).slice(0, 4)
	);
</script>

<a
	href="/vision-board"
	class="flex flex-col rounded-card border border-subtle bg-surface p-4.5 transition-colors hover:border-accent/60 {className}"
>
	<div class="mb-4 flex items-center justify-between gap-2">
		<h2 class={sectionHeading}>Vision board</h2>
		<Icon name="chevron-right" size={14} class="text-muted" />
	</div>

	{#if preview.length === 0}
		<div class="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
			<Icon name="vision" size={20} class="text-muted" />
			<p class="text-xs text-muted">No images yet — visit the board to add one.</p>
			<span class={button.ghost}>Open board</span>
		</div>
	{:else}
		<div class="grid flex-1 grid-cols-2 grid-rows-2 gap-1.5 overflow-hidden rounded-control">
			{#each preview as item (item.id)}
				<VisionImage path={item.imagePath} alt="" class="h-full w-full object-cover" />
			{/each}
		</div>
	{/if}
</a>
```

- [ ] **Step 2: Verify with svelte-check**

Run: `npm run check`
Expected: no new errors attributable to `DashboardVisionPreview.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/DashboardVisionPreview.svelte
git commit -m "feat: add DashboardVisionPreview component"
```

---

### Task 4: `DashboardTasksToday.svelte`

**Files:**
- Create: `src/lib/components/DashboardTasksToday.svelte`

**Interfaces:**
- Consumes: `TaskSummary` from `$lib/api`; `todaysTasks` from `$lib/dashboard` (Task 1); `TaskRow` from `./TaskRow.svelte`; `sectionHeading` from `./ui`.
- Produces: `<DashboardTasksToday tasks={data.tasks} onMutated={invalidateAll} onError={(e) => (actionError = e)} class="..." />` (consumed by Task 8). `TaskRow` requires `onMutated`/`onError` per task — both are threaded straight through from the page.

- [ ] **Step 1: Write the component**

Create `src/lib/components/DashboardTasksToday.svelte`:

```svelte
<script lang="ts">
	import type { TaskSummary } from '$lib/api';
	import { todaysTasks } from '$lib/dashboard';
	import TaskRow from './TaskRow.svelte';
	import { sectionHeading } from './ui';

	interface Props {
		tasks: TaskSummary[];
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
		class?: string;
	}

	let { tasks, onMutated, onError, class: className = '' }: Props = $props();

	const today = $derived(todaysTasks(tasks));
</script>

<section class="flex flex-col overflow-y-auto rounded-card border border-subtle bg-surface p-4.5 {className}">
	<h2 class="{sectionHeading} mb-3">Today's tasks</h2>

	{#if today.length === 0}
		<p class="flex-1 py-8 text-center text-md text-muted">Nothing due today.</p>
	{:else}
		<ul class="flex flex-col gap-0.5">
			{#each today as task (task.id)}
				<TaskRow {task} {onMutated} {onError} />
			{/each}
		</ul>
	{/if}
</section>
```

- [ ] **Step 2: Verify with svelte-check**

Run: `npm run check`
Expected: no new errors attributable to `DashboardTasksToday.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/DashboardTasksToday.svelte
git commit -m "feat: add DashboardTasksToday component"
```

---

### Task 5: `DashboardStreaks.svelte`

**Files:**
- Create: `src/lib/components/DashboardStreaks.svelte`

**Interfaces:**
- Consumes: `StreakCard` type + `StreakCard` component from `$lib/api` / `./StreakCard.svelte`; `topStreaks` from `$lib/dashboard` (Task 1); `sectionHeading` from `./ui`.
- Produces: `<DashboardStreaks streaks={data.streaks} class="..." />` (consumed by Task 8). Deliberately omits `onToggle`/`busy` on `StreakCard` — read-only per its own doc comment.

- [ ] **Step 1: Write the component**

Create `src/lib/components/DashboardStreaks.svelte`:

```svelte
<script lang="ts">
	import type { StreakCard as StreakCardData } from '$lib/api';
	import { topStreaks } from '$lib/dashboard';
	import Icon from './Icon.svelte';
	import StreakCard from './StreakCard.svelte';
	import { sectionHeading } from './ui';

	interface Props {
		streaks: StreakCardData[];
		class?: string;
	}

	let { streaks, class: className = '' }: Props = $props();

	const top = $derived(topStreaks(streaks));
</script>

<section class="flex flex-col rounded-card border border-subtle bg-surface p-4.5 {className}">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class={sectionHeading}>Streaks</h2>
		{#if streaks.length > top.length}
			<a href="/tasks" class="flex items-center gap-0.5 text-xs font-semibold text-muted hover:text-content">
				View all
				<Icon name="chevron-right" size={12} />
			</a>
		{/if}
	</div>

	{#if top.length === 0}
		<p class="flex-1 py-8 text-center text-md text-muted">No habits tracked yet.</p>
	{:else}
		<div class="grid gap-3 sm:grid-cols-2">
			{#each top as card (card.task.id)}
				<StreakCard {card} />
			{/each}
		</div>
	{/if}
</section>
```

- [ ] **Step 2: Verify with svelte-check**

Run: `npm run check`
Expected: no new errors attributable to `DashboardStreaks.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/DashboardStreaks.svelte
git commit -m "feat: add DashboardStreaks component"
```

---

### Task 6: `DashboardUpcoming.svelte`

**Files:**
- Create: `src/lib/components/DashboardUpcoming.svelte`

**Interfaces:**
- Consumes: `GoalSummary`, `Subgoal`, `TaskSummary` from `$lib/api`; `buildUpcomingFeed` from `$lib/dashboard` (Task 1); `dueLabel`, `dueTone` from `$lib/format`; `sectionHeading` from `./ui`.
- Produces: `<DashboardUpcoming goals={data.goals} subgoals={data.subgoals} tasks={data.tasks} class="..." />` (consumed by Task 8).

- [ ] **Step 1: Write the component**

Create `src/lib/components/DashboardUpcoming.svelte`:

```svelte
<script lang="ts">
	import type { GoalSummary, Subgoal, TaskSummary } from '$lib/api';
	import { buildUpcomingFeed } from '$lib/dashboard';
	import { dueLabel, dueTone } from '$lib/format';
	import { sectionHeading } from './ui';

	interface Props {
		goals: GoalSummary[];
		subgoals: Subgoal[];
		tasks: TaskSummary[];
		class?: string;
	}

	let { goals, subgoals, tasks, class: className = '' }: Props = $props();

	const DUE_CLASSES = {
		none: 'text-muted',
		later: 'text-muted',
		soon: 'font-semibold text-accent-tertiary',
		overdue: 'font-bold text-warn'
	};

	const KIND_LABELS = { goal: 'Goal', subgoal: 'Subgoal', task: 'Task' };

	const upcoming = $derived(buildUpcomingFeed(goals, subgoals, tasks).slice(0, 8));
</script>

<section class="flex flex-col overflow-y-auto rounded-card border border-subtle bg-surface p-4.5 {className}">
	<h2 class="{sectionHeading} mb-3">Upcoming</h2>

	{#if upcoming.length === 0}
		<p class="flex-1 py-8 text-center text-md text-muted">Nothing due soon.</p>
	{:else}
		<ul class="flex flex-col gap-2.5">
			{#each upcoming as item (`${item.kind}-${item.id}`)}
				<li class="flex items-center gap-2.5 text-sm">
					<span class="w-14 shrink-0 text-2xs font-bold tracking-wider text-muted uppercase">
						{KIND_LABELS[item.kind]}
					</span>
					{#if item.href}
						<a href={item.href} class="min-w-0 flex-1 truncate hover:text-accent">
							{item.title}
							{#if item.parentLabel}
								<span class="text-muted">· {item.parentLabel}</span>
							{/if}
						</a>
					{:else}
						<span class="min-w-0 flex-1 truncate">{item.title}</span>
					{/if}
					<span class="shrink-0 text-xs {DUE_CLASSES[dueTone(item.dueDate)]}">
						{dueLabel(item.dueDate)}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
```

- [ ] **Step 2: Verify with svelte-check**

Run: `npm run check`
Expected: no new errors attributable to `DashboardUpcoming.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/DashboardUpcoming.svelte
git commit -m "feat: add DashboardUpcoming component"
```

---

### Task 7: `DashboardQuickAdd.svelte`

**Files:**
- Create: `src/lib/components/DashboardQuickAdd.svelte`

**Interfaces:**
- Consumes: `createIdea`, `createTask`, `createGoal` from `$lib/api`; `segment`, `field`, `button` from `./ui`; `Icon` from `./Icon.svelte`.
- Produces: `<DashboardQuickAdd onAdded={invalidateAll} onError={(e) => (actionError = e)} />` (consumed by Task 8).

- [ ] **Step 1: Write the component**

Create `src/lib/components/DashboardQuickAdd.svelte`:

```svelte
<script lang="ts">
	import { createGoal, createIdea, createTask } from '$lib/api';
	import Icon from './Icon.svelte';
	import { button, field, segment } from './ui';

	type QuickAddKind = 'idea' | 'task' | 'goal';

	interface Props {
		onAdded: () => Promise<void> | void;
		onError: (error: unknown) => void;
		class?: string;
	}

	let { onAdded, onError, class: className = '' }: Props = $props();

	const KINDS: { value: QuickAddKind; label: string; icon: 'idea' | 'task' | 'goal' }[] = [
		{ value: 'idea', label: 'Idea', icon: 'idea' },
		{ value: 'task', label: 'Task', icon: 'task' },
		{ value: 'goal', label: 'Goal', icon: 'goal' }
	];

	let kind = $state<QuickAddKind>('idea');
	let title = $state('');
	let submitting = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const value = title.trim();
		if (!value || submitting) return;

		submitting = true;
		try {
			if (kind === 'idea') {
				await createIdea({ title: value, note: null, tagNames: [] });
			} else if (kind === 'task') {
				await createTask({ title: value, dueDate: null, goalId: null, subgoalId: null, recurrence: null });
			} else {
				await createGoal({
					categoryId: null,
					title: value,
					description: null,
					timeframe: 'short',
					dueDate: null,
					motivationText: null,
					motivationImagePath: null,
					repoUrl: null
				});
			}
			title = '';
			await onAdded();
		} catch (error) {
			onError(error);
		} finally {
			submitting = false;
		}
	}
</script>

<form
	onsubmit={submit}
	class="flex items-center gap-3 rounded-card border border-subtle bg-surface p-3.5 {className}"
>
	<div class="flex w-44 shrink-0 gap-1.5" role="group" aria-label="Quick-add type">
		{#each KINDS as option (option.value)}
			<button
				type="button"
				class={segment(kind === option.value)}
				aria-pressed={kind === option.value}
				onclick={() => (kind = option.value)}
			>
				<span class="flex items-center justify-center gap-1">
					<Icon name={option.icon} size={12} />
					{option.label}
				</span>
			</button>
		{/each}
	</div>

	<input
		type="text"
		bind:value={title}
		placeholder="Quick-add a {kind}…"
		disabled={submitting}
		class={field.input}
	/>

	<button type="submit" class={button.primary} disabled={submitting || !title.trim()}>
		<Icon name="plus" size={15} weight={2.4} />
		Add
	</button>
</form>
```

- [ ] **Step 2: Verify with svelte-check**

Run: `npm run check`
Expected: no new errors attributable to `DashboardQuickAdd.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/DashboardQuickAdd.svelte
git commit -m "feat: add DashboardQuickAdd component"
```

---

### Task 8: Wire the Dashboard route and sidebar entry

**Files:**
- Modify: `src/routes/+page.ts` (currently just `redirect(307, '/goals')`)
- Modify: `src/routes/+page.svelte` (currently doesn't render dashboard content)
- Modify: `src/routes/+layout.svelte:14-25` (NAV array + stale comment)

**Interfaces:**
- Consumes everything produced by Tasks 1–7: `dashboard.ts` helpers (used inside the child components, not directly here), and all six `Dashboard*.svelte` components.

- [ ] **Step 1: Replace the redirect with a real load**

Replace the full contents of `src/routes/+page.ts`:

```ts
import { listCategories, listGoals, listStreaks, listSubgoals, listTasks, listVisionItems } from '$lib/api';

export const load = async () => {
	try {
		const [categories, goals, subgoals, tasks, streaks, visionItems] = await Promise.all([
			listCategories(),
			listGoals('active'),
			listSubgoals(),
			listTasks(),
			listStreaks(),
			listVisionItems()
		]);
		return { categories, goals, subgoals, tasks, streaks, visionItems, error: null };
	} catch (error) {
		return { categories: [], goals: [], subgoals: [], tasks: [], streaks: [], visionItems: [], error };
	}
};
```

`listGoals('active')` (not `null`) is deliberate: it's the goal set for both the Active Goals panel and the Upcoming feed's "only active goals" rule, avoiding a second fetch.

- [ ] **Step 2: Write the dashboard page**

Replace the full contents of `src/routes/+page.svelte`:

```svelte
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import DashboardGoalsPanel from '$lib/components/DashboardGoalsPanel.svelte';
	import DashboardQuickAdd from '$lib/components/DashboardQuickAdd.svelte';
	import DashboardStreaks from '$lib/components/DashboardStreaks.svelte';
	import DashboardTasksToday from '$lib/components/DashboardTasksToday.svelte';
	import DashboardUpcoming from '$lib/components/DashboardUpcoming.svelte';
	import DashboardVisionPreview from '$lib/components/DashboardVisionPreview.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';

	let { data } = $props();

	let actionError = $state<unknown>(null);

	const onError = (error: unknown) => {
		actionError = error;
	};
</script>

<svelte:head><title>Dashboard · Mushpoint</title></svelte:head>

<header class="mb-6">
	<h1 class="mb-1 font-display text-3xl font-bold">Dashboard</h1>
	<p class="text-sm text-muted">Where everything stands right now.</p>
</header>

{#if data.error}
	<div class="mb-6"><ErrorBanner error={data.error} /></div>
{/if}
{#if actionError}
	<div class="mb-6"><ErrorBanner error={actionError} onDismiss={() => (actionError = null)} /></div>
{/if}

<div class="grid grid-cols-1 gap-4 lg:auto-rows-[minmax(160px,auto)] lg:grid-cols-12">
	<DashboardGoalsPanel
		goals={data.goals}
		categories={data.categories}
		class="mp-enter lg:col-span-7 lg:row-span-2 lg:col-start-1 lg:row-start-1"
	/>
	<DashboardVisionPreview
		items={data.visionItems}
		class="mp-enter lg:col-span-5 lg:col-start-8 lg:row-start-1"
	/>
	<DashboardTasksToday
		tasks={data.tasks}
		onMutated={invalidateAll}
		{onError}
		class="mp-enter lg:col-span-5 lg:col-start-8 lg:row-start-2"
	/>
	<DashboardStreaks
		streaks={data.streaks}
		class="mp-enter lg:col-span-6 lg:col-start-1 lg:row-start-3"
	/>
	<DashboardUpcoming
		goals={data.goals}
		subgoals={data.subgoals}
		tasks={data.tasks}
		class="mp-enter lg:col-span-6 lg:col-start-7 lg:row-start-3"
	/>
	<DashboardQuickAdd onAdded={invalidateAll} {onError} class="mp-enter lg:col-span-12 lg:row-start-4" />
</div>
```

Layout notes: 12-column grid on `lg`+, single stacked column below it (mobile order follows source order: goals → vision → today → streaks → upcoming → quick add). Row 1–2 holds the Active Goals panel spanning two rows on the left plus the Vision preview and Today's tasks stacked on the right — the densest region, with Vision preview landing top-right per spec. Row 3 tapers to two half-width blocks. Row 4 is one full-width slim quick-add bar. `ProgressBar`/`ProgressRing`/`StreakHeatmap` already animate on mount internally; the top-level `mp-enter` class on each of the six cards gives the whole grid a one-shot fade/rise on load (no `stagger()` here since these six are simultaneous panels, not a repeated list — `stagger()` is used *inside* `DashboardGoalsPanel`'s own goal rows).

- [ ] **Step 3: Add the sidebar entry**

In `src/routes/+layout.svelte`, replace lines 14-25:

```svelte
	const NAV: { href: string; label: string; icon: IconName }[] = [
		{ href: '/goals', label: 'Goal Tracker', icon: 'goal' },
		{ href: '/tasks', label: 'Task Manager', icon: 'task' },
		{ href: '/ideas', label: 'Idea Vault', icon: 'idea' },
		{ href: '/vision-board', label: 'Vision Board', icon: 'vision' },
		{ href: '/settings', label: 'Settings', icon: 'settings' }
	];
```

with:

```svelte
	const NAV: { href: string; label: string; icon: IconName }[] = [
		{ href: '/', label: 'Dashboard', icon: 'dashboard' },
		{ href: '/goals', label: 'Goal Tracker', icon: 'goal' },
		{ href: '/tasks', label: 'Task Manager', icon: 'task' },
		{ href: '/ideas', label: 'Idea Vault', icon: 'idea' },
		{ href: '/vision-board', label: 'Vision Board', icon: 'vision' },
		{ href: '/settings', label: 'Settings', icon: 'settings' }
	];
```

`isCurrent(href)` (`src/routes/+layout.svelte:43`) does `page.url.pathname.startsWith(href)` — for `href: '/'` this is `true` on every route, which would wrongly highlight "Dashboard" everywhere. Fix `isCurrent` right below it to special-case the root:

```svelte
	const isCurrent = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
```

- [ ] **Step 4: Verify with svelte-check**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev` (or the project's Tauri dev command if available), open the app.
Expected, walking every spec point:
- App loads at `/` and shows the Dashboard, not a redirect to `/goals`.
- Sidebar shows "Dashboard" as the first item, highlighted only when on `/`, not on other routes.
- Active goals panel shows progress bars grouped by category; clicking a goal navigates to `/goals/{id}`.
- Vision preview shows up to 4 images in a 2×2 grid (or the empty state if the vision board has no images); clicking it navigates to `/vision-board`.
- Today's tasks shows only tasks due today or expected-today habits; checking one off updates it in place (via `TaskRow`'s own mutation) without a full page reload glitch.
- Streaks shows up to 3 cards with current/longest and a heatmap strip, read-only (no checkbox); "View all" link (if shown) goes to `/tasks`.
- Upcoming shows a merged, sorted list with overdue items visually distinct (`text-warn`/bold) from soon/later ones.
- Quick-add: switch the toggle to each of Idea/Task/Goal, type a title, submit, and confirm the new record shows up on `/ideas`, `/tasks`, and `/goals` respectively.
- Toggle `prefers-reduced-motion` (OS setting or devtools emulation) and confirm the grid still renders correctly with instant (non-animated) transitions.
- Resize the window below the `lg` breakpoint and confirm the grid collapses to a single stacked column in source order.

- [ ] **Step 6: Commit**

```bash
git add src/routes/+page.ts src/routes/+page.svelte src/routes/+layout.svelte
git commit -m "feat: wire up the Dashboard route and sidebar entry"
```

---

## Self-Review Notes

- **Spec coverage:** All six `ui-plan.md` Dashboard blocks (active goals, vision preview, today's tasks, streaks, upcoming, quick-add) map 1:1 to Tasks 2–7; the bento "denser toward the top" layout and "vision preview top-right" placement are both explicit in Task 8's grid classes; motion rules are satisfied by reusing `mp-enter`/`stagger()`/existing component-internal animations, with `prefers-reduced-motion` already handled globally in `theme.css` (verified manually in Task 8 Step 5).
- **`isCurrent` root-path bug:** caught during design — `startsWith('/')` matches everything, so Task 8 Step 3 includes the necessary fix alongside the NAV entry, not as an afterthought.
- **Type consistency:** `UpcomingItem`/`UpcomingKind` (Task 1) are consumed verbatim by `DashboardUpcoming.svelte` (Task 6) with no renaming. `todaysTasks`/`buildUpcomingFeed`/`topStreaks` signatures match between Task 1's implementation and every consuming component's import. All `*Input` shapes in `DashboardQuickAdd.svelte` (Task 7) match `IdeaInput`/`TaskInput`/`GoalInput` from `src/lib/api/types.ts` field-for-field, verified directly against that file during design (not assumed).
- **No placeholders:** every task has literal file contents, not descriptions of what to write.
