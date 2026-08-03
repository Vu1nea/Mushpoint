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
