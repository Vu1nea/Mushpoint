<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		deleteTask,
		RECURRENCE_LABELS,
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

	let { data } = $props();

	let drawerOpen = $state(false);
	let editingTask = $state<TaskSummary | null>(null);
	let deletingTask = $state<TaskSummary | null>(null);
	let busy = $state(false);
	let actionError = $state<unknown>(null);
	/** Set for a moment after a card changes column, to play the move pulse. */
	let justMovedId = $state<number | null>(null);
	let moveTimer: ReturnType<typeof setTimeout>;

	const goalTitles = $derived(new Map(data.goals.map((goal) => [goal.id, goal.title])));
	const subgoalTitles = $derived(
		new Map(data.subgoals.map((subgoal) => [subgoal.id, subgoal.title]))
	);

	/** "Goal / Subgoal", "Goal", or nothing at all for a standalone task. */
	function parentLabel(task: TaskSummary): string | null {
		const goal = task.goalId ? goalTitles.get(task.goalId) : null;
		const subgoal = task.subgoalId ? subgoalTitles.get(task.subgoalId) : null;

		if (goal && subgoal) return `${goal} / ${subgoal}`;
		return subgoal ?? goal ?? null;
	}

	/**
	 * A habit has no lasting status: its column is today's completion state, so the
	 * board empties itself at midnight without any scheduled job.
	 *
	 * Named `taskColumn` rather than `column` because the board markup below already
	 * uses `column` as the loop variable for each board column.
	 */
	function taskColumn(task: TaskSummary): TaskStatus {
		if (!task.recurrence) return task.status;
		return task.completedToday ? 'done' : 'todo';
	}

	const columns = $derived(
		TASK_STATUSES.map((status) => ({
			status,
			label: TASK_STATUS_LABELS[status],
			tasks: data.tasks.filter((task) => taskColumn(task) === status)
		}))
	);

	/** Pill color per status — matches the "in progress" and "recurring" tags elsewhere. */
	const STATUS_PILL_CLASSES: Record<TaskStatus, string> = {
		todo: 'bg-surface-raised text-muted hover:text-content',
		in_progress: 'bg-accent-tertiary/20 text-accent-tertiary hover:bg-accent-tertiary/30',
		done: 'bg-accent-secondary/20 text-accent-secondary hover:bg-accent-secondary/30'
	};

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

	/** Clicking a card walks it to the next column, wrapping Done back to To Do. */
	async function advance(task: TaskSummary) {
		const next: TaskStatus =
			TASK_STATUSES[(TASK_STATUSES.indexOf(task.status) + 1) % TASK_STATUSES.length];

		justMovedId = task.id;
		clearTimeout(moveTimer);
		moveTimer = setTimeout(() => (justMovedId = null), 500);

		await run(() => setTaskStatus(task.id, next));
	}

	async function toggleToday(task: { id: number }, done: boolean) {
		justMovedId = task.id;
		clearTimeout(moveTimer);
		moveTimer = setTimeout(() => (justMovedId = null), 500);

		await run(() => setTaskCompletion(task.id, done));
	}

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

<svelte:head><title>Tasks · Mushpoint</title></svelte:head>

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

{#if data.error}
	<div class="mb-6"><ErrorBanner error={data.error} /></div>
{/if}
{#if actionError}
	<div class="mb-6"><ErrorBanner error={actionError} onDismiss={() => (actionError = null)} /></div>
{/if}

{#if data.streaks.length > 0}
	<section class="mb-6">
		<h2 class="{sectionHeading} mb-3">Streaks</h2>
		<div class="grid gap-4 sm:grid-cols-2">
			{#each data.streaks as card (card.task.id)}
				<StreakCard {card} {busy} onToggle={(done) => toggleToday(card.task, done)} />
			{/each}
		</div>
	</section>
{/if}

<div class="grid gap-4 md:grid-cols-3">
	{#each columns as column (column.status)}
		<section
			class="flex min-h-50 flex-col gap-2.5 rounded-card border border-subtle bg-surface p-3.5"
		>
			<h2 class="flex justify-between {sectionHeading} text-xs">
				<span>{column.label}</span>
				<span class="tabular-nums">{column.tasks.length}</span>
			</h2>

			{#each column.tasks as task, index (task.id)}
				{@const parent = parentLabel(task)}
				{@const action = pill(task)}
				<div
					class="group relative rounded-card border bg-background p-4.5 transition-shadow {justMovedId ===
					task.id
						? 'mp-pulse border-accent ring-3 ring-accent/30'
						: 'mp-enter border-subtle'}"
					style="--mp-delay:{stagger(index, 30)}"
				>
					<div class="flex items-start gap-2">
						<span
							class="min-w-0 flex-1 text-sm leading-snug font-semibold {taskColumn(task) === 'done'
								? 'text-muted line-through'
								: ''}"
						>
							{task.title}
						</span>

						<div
							class="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
						>
							<button type="button" class={button.bare} onclick={() => edit(task)}>
								<Icon name="edit" size={13} label="Edit {task.title}" />
							</button>
							<button
								type="button"
								class={button.bare}
								disabled={busy}
								onclick={() => (deletingTask = task)}
							>
								<Icon name="trash" size={13} label="Delete {task.title}" />
							</button>
						</div>
					</div>

					<div class="mt-2.5 flex flex-wrap items-center gap-2">
						<button
							type="button"
							class="shrink-0 rounded-full px-2.5 py-1 text-2xs font-semibold transition-colors disabled:opacity-50 {STATUS_PILL_CLASSES[
								taskColumn(task)
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
								class="max-w-45 truncate rounded-full bg-accent/15 px-2.5 py-1 text-2xs font-semibold text-accent transition-colors hover:bg-accent/25"
							>
								{parent}
							</a>
						{/if}
						{#if task.recurrence}
							<span
								class="flex items-center gap-1 rounded-full bg-accent-secondary/15 px-2.5 py-1 text-2xs font-semibold text-accent-secondary"
							>
								<Icon name="flame" size={11} />
								{RECURRENCE_LABELS[task.recurrence]}
							</span>
						{/if}
						{#if task.dueDate}
							<span
								class="text-2xs {dueTone(task.dueDate) === 'overdue'
									? 'font-semibold text-warn'
									: 'text-muted'}"
							>
								{dueLabel(task.dueDate)}
							</span>
						{/if}
					</div>
				</div>
			{/each}

			{#if column.tasks.length === 0}
				<p class="px-2 py-6 text-center text-xs text-muted/70">Nothing here.</p>
			{/if}
		</section>
	{/each}
</div>

<TaskDrawer
	open={drawerOpen}
	goals={data.goals}
	subgoals={data.subgoals}
	task={editingTask}
	onClose={() => (drawerOpen = false)}
	onSaved={invalidateAll}
/>

<ConfirmDialog
	open={deletingTask !== null}
	title="Delete “{deletingTask?.title ?? ''}”?"
	body="The task is removed from the board. This cannot be undone."
	{busy}
	onConfirm={removeTask}
	onCancel={() => (deletingTask = null)}
/>
