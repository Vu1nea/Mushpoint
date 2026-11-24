<!-- app/src/lib/components/tasks/KanbanBoard.svelte -->
<script lang="ts">
	import { flip } from 'svelte/animate';
	import { tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';

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
	import {
		filterTasks,
		groupByStatus,
		moveTargets,
		NO_FILTER,
		PAGE_SIZE,
		pageOf,
		recentFirst,
		type DueFilter
	} from '$lib/kanban';
	import { motion, stagger } from '$lib/motion';
	import { isInertToday } from '$lib/taskList';
	import { optimistic } from '$lib/optimistic';
	import Icon from '../ui/Icon.svelte';
	import TaskBoardToolbar from './TaskBoardToolbar.svelte';
	import Tabs from '../ui/Tabs.svelte';
	import { tabId, tabPanelId } from '../ui/tabIds';
	import { button, field, sectionHeading } from '../ui';

	interface Props {
		goalId?: number | null;
		tasks: TaskSummary[];
		subgoals: Pick<SubgoalDetail, 'id' | 'title'>[];
		goals?: GoalSummary[];
		parentChipMode: 'subgoal-only' | 'goal-and-subgoal';
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
		onEditTask: (task: TaskSummary) => void;
		onDeleteTask: (task: TaskSummary) => void;
		/** Show the search and filters above the board. Off when the page supplies them. */
		toolbar?: boolean;
		query?: string;
		due?: DueFilter;
		goalFilter?: string;
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
		onDeleteTask,
		toolbar = true,
		query = $bindable(NO_FILTER.query),
		due = $bindable(NO_FILTER.due),
		goalFilter = $bindable('')
	}: Props = $props();

	let busy = $state(false);
	let dragOverStatus = $state<TaskStatus | null>(null);
	/** Set for a moment after a card changes column, to play the move pulse. */
	let justMovedId = $state<number | null>(null);
	let moveTimer: ReturnType<typeof setTimeout>;
	$effect(() => () => clearTimeout(moveTimer));
	let newTaskTitles = $state<Record<TaskStatus, string>>({
		todo: '',
		in_progress: '',
		done: ''
	});

	/** Moves the user just made, shown until fresh data arrives. */
	let pending = $state<Record<number, Partial<TaskSummary>>>({});
	const shown = $derived(tasks.map((t) => (pending[t.id] ? { ...t, ...pending[t.id] } : t)));

	const subgoalNames = $derived(new Map(subgoals.map((s) => [s.id, s.title])));
	const goalTitles = $derived(new Map(goals.map((g) => [g.id, g.title])));

	const FIRST_PAGES: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0 };

	let pages = $state({ ...FIRST_PAGES });

	/** Below md the board shows one column at a time, picked with tabs. */
	const TABS_ID = 'kanban-column';
	const phone = new MediaQuery('max-width: 47.98rem', false);
	let activeStatus = $state<TaskStatus>('todo');

	/** The card whose "Move to…" menu is open. */
	let moveMenuFor = $state<number | null>(null);
	let moveMenu = $state<HTMLElement>();
	let moveMenuOpener: HTMLElement | undefined;

	function openMoveMenu(event: MouseEvent, task: TaskSummary) {
		if (moveMenuFor === task.id) return closeMoveMenu();
		moveMenuOpener = event.currentTarget as HTMLElement;
		moveMenuFor = task.id;
		tick().then(() => moveMenu?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
	}

	function closeMoveMenu(refocus = true) {
		moveMenuFor = null;
		if (refocus) moveMenuOpener?.focus();
	}

	function moveMenuKeydown(event: KeyboardEvent) {
		const items = [...(moveMenu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
		const index = items.indexOf(document.activeElement as HTMLElement);
		if (event.key === 'Escape') {
			event.preventDefault();
			closeMoveMenu();
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const delta = event.key === 'ArrowDown' ? 1 : -1;
			items[(index + delta + items.length) % items.length]?.focus();
		} else if (event.key === 'Tab') {
			closeMoveMenu(false);
		}
	}

	function windowClick(event: MouseEvent) {
		if (moveMenuFor === null) return;
		if (!(event.target as Element | null)?.closest?.('[data-move-menu]')) closeMoveMenu(false);
	}

	const filtering = $derived(query.trim() !== '' || due !== 'all' || goalFilter !== '');
	const columns = $derived(
		groupByStatus(
			filterTasks(shown, { query, due, goalId: goalFilter ? Number(goalFilter) : null })
		)
	);
	const tabs = $derived(
		TASK_STATUSES.map((status) => ({
			value: status,
			label: `${TASK_STATUS_LABELS[status]} (${columns[status].length})`
		}))
	);
	const paged = $derived({
		todo: pageOf(columns.todo, pages.todo, PAGE_SIZE),
		in_progress: pageOf(columns.in_progress, pages.in_progress, PAGE_SIZE),
		done: pageOf(recentFirst(columns.done), pages.done, PAGE_SIZE)
	});

	function resetPages() {
		pages = { ...FIRST_PAGES };
	}

	// A new search or filter starts every column back on its first page.
	$effect(() => {
		query;
		due;
		goalFilter;
		resetPages();
	});

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
		if (task.recurrence && status === 'in_progress') return; // a habit has no in-progress state

		justMovedId = task.id;
		clearTimeout(moveTimer);
		moveTimer = setTimeout(() => (justMovedId = null), 500);

		const recurring = Boolean(task.recurrence);
		const change: Partial<TaskSummary> = recurring
			? { completedToday: status === 'done' }
			: { status, updatedAt: new Date().toISOString() };
		return optimistic<unknown>({
			key: `task:${task.id}`,
			apply: () => (pending[task.id] = change),
			revert: () => delete pending[task.id],
			call: () =>
				recurring ? setTaskCompletion(task.id, status === 'done') : setTaskStatus(task.id, status),
			refresh: async () => {
				await onMutated();
			},
			onError,
			settle: () => delete pending[task.id]
		});
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
		const task = shown.find((t) => t.id === id);
		if (task && !columns[status].includes(task)) moveTask(task, status);
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

<svelte:window onclick={windowClick} />

{#if toolbar}
	<div class="mb-3.5">
		<TaskBoardToolbar {goals} bind:query bind:due bind:goalFilter />
	</div>
{/if}

<Tabs
	class="mb-3.5 md:hidden"
	id={TABS_ID}
	label="Board column"
	{tabs}
	value={activeStatus}
	onChange={(next) => (activeStatus = next)}
/>

<div class="grid md:grid-cols-3 md:divide-x md:divide-subtle">
	{#each TASK_STATUSES as status (status)}
		<section
			class="{status === activeStatus
				? 'flex'
				: 'hidden md:flex'} min-h-50 flex-col gap-2.5 p-3.5 transition-colors {dragOverStatus ===
			status
				? 'bg-accent/5 outline-2 -outline-offset-2 outline-accent'
				: ''}"
			role={phone.current ? 'tabpanel' : undefined}
			id={phone.current ? tabPanelId(TABS_ID, status) : undefined}
			aria-labelledby={phone.current ? tabId(TABS_ID, status) : undefined}
			ondragover={(event) => dragOver(event, status)}
			ondragleave={() => dragLeave(status)}
			ondrop={(event) => drop(event, status)}
		>
			<h2 class="flex justify-between {sectionHeading} text-xs">
				<span>{TASK_STATUS_LABELS[status]}</span>
				<span class="tabular-nums">{columns[status].length}</span>
			</h2>

			{#each paged[status].items as task, index (task.id)}
				{@const parent = parentLabel(task)}
				{@const inert = busy || isInertToday(task)}
				{@const targets = moveTargets(task)}
				<article
					aria-label={task.title}
					class="group rounded-card border p-3.5 transition-shadow {moveMenuFor === task.id
						? 'relative z-10'
						: ''} {justMovedId === task.id
						? 'mp-pulse border-accent ring-3 ring-accent/30'
						: 'mp-enter border-subtle'}"
					style="--mp-delay:{stagger(index, 30)}"
					draggable={!inert}
					ondragstart={(event) => dragStart(event, task)}
					animate:flip={{ duration: motion(200) }}
				>
					<div class="flex items-start gap-2">
						<button
							type="button"
							class="block min-w-0 flex-1 text-left text-sm font-semibold {status === 'done'
								? 'text-muted line-through'
								: ''}"
							onclick={() => onEditTask(task)}
						>
							{task.title}
						</button>

						<div
							class="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100"
						>
							<button type="button" class="{button.bare} mp-hit" onclick={() => onEditTask(task)}>
								<Icon name="edit" size={13} label="Edit {task.title}" />
							</button>
							<button
								type="button"
								class="{button.bare} mp-hit"
								disabled={busy}
								onclick={() => onDeleteTask(task)}
							>
								<Icon name="trash" size={13} label="Delete {task.title}" />
							</button>
						</div>
					</div>

					<div class="mt-2 flex flex-wrap items-center gap-2">
						{#if parent}
							{#if parentChipMode === 'goal-and-subgoal' && task.goalId != null}
								<a
									href="/goals/{task.goalId}"
									title={parent}
									class="max-w-45 truncate rounded-full bg-accent/15 px-2.5 py-0.5 text-2xs font-semibold text-accent-ink transition-colors hover:bg-accent/25"
								>
									{parent}
								</a>
							{:else}
								<span
									title={parent}
									class="max-w-32 truncate rounded-full bg-accent/15 px-2.5 py-0.5 text-2xs font-semibold text-accent-ink"
								>
									{parent}
								</span>
							{/if}
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
						<div class="mt-2 flex items-center justify-end gap-1">
							{@render moveControl(task, targets)}
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
						<div class="mt-2 flex items-center justify-end gap-1">
							{@render moveControl(task, targets)}
							{#if status !== 'todo'}
								<button
									type="button"
									class="{button.bare} mp-hit"
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
									class="{button.bare} mp-hit"
									disabled={inert}
									onclick={() => step(task, 1)}
								>
									<Icon name="chevron-right" size={13} label="Move {task.title} right" />
								</button>
							{/if}
						</div>
					{/if}
				</article>
			{/each}

			{#if columns[status].length === 0}
				<p class="px-2 py-6 text-center text-xs text-muted">
					{filtering ? 'No matching tasks' : 'No tasks'}
				</p>
			{/if}

			{#if paged[status].pageCount > 1}
				<div class="flex items-center justify-center gap-2 text-2xs text-muted">
					<button
						type="button"
						class="{button.bare} mp-hit"
						disabled={paged[status].page === 0}
						onclick={() => (pages[status] = paged[status].page - 1)}
					>
						<Icon
							name="chevron-right"
							size={13}
							class="rotate-180"
							label="Previous page of {TASK_STATUS_LABELS[status]}"
						/>
					</button>
					<span class="tabular-nums">{paged[status].page + 1} / {paged[status].pageCount}</span>
					<button
						type="button"
						class="{button.bare} mp-hit"
						disabled={paged[status].page === paged[status].pageCount - 1}
						onclick={() => (pages[status] = paged[status].page + 1)}
					>
						<Icon
							name="chevron-right"
							size={13}
							label="Next page of {TASK_STATUS_LABELS[status]}"
						/>
					</button>
				</div>
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

<!-- Non-drag way to change a card's column (touch has no HTML5 drag). Funnels
     through `moveTask`, the same path a drop takes. -->
{#snippet moveControl(task: TaskSummary, targets: TaskStatus[])}
	{#if targets.length > 0}
		<div class="relative mr-auto" data-move-menu>
			<button
				type="button"
				class="{button.bare} mp-hit px-1.5 text-2xs font-semibold"
				aria-haspopup="menu"
				aria-expanded={moveMenuFor === task.id}
				aria-label="Move {task.title} to…"
				disabled={busy}
				onclick={(event) => openMoveMenu(event, task)}
			>
				Move to…
			</button>
			{#if moveMenuFor === task.id}
				<div
					bind:this={moveMenu}
					role="menu"
					tabindex="-1"
					aria-label="Move {task.title} to"
					class="absolute top-full left-0 z-20 mt-1 flex min-w-36 flex-col rounded-control border border-subtle bg-surface p-1 shadow-[0_12px_30px_rgba(0,0,0,0.25)]"
					onkeydown={moveMenuKeydown}
				>
					{#each targets as target (target)}
						<button
							type="button"
							role="menuitem"
							class="rounded-control px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/10 focus-visible:bg-accent/10 focus-visible:outline-none"
							onclick={() => {
								closeMoveMenu();
								moveTask(task, target);
							}}
						>
							{TASK_STATUS_LABELS[target]}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
{/snippet}
