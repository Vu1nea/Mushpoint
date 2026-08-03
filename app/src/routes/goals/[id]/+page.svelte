<script lang="ts">
	import { openUrl as openExternal } from '@tauri-apps/plugin-opener';
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import {
		createSubgoal,
		createTask,
		deleteGoal,
		deleteTask,
		TIMEFRAME_LABELS,
		type TaskSummary
	} from '$lib/api';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import Checkbox from '$lib/components/Checkbox.svelte';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import GoalDrawer from '$lib/components/GoalDrawer.svelte';
	import GoalStatusSegment from '$lib/components/GoalStatusSegment.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import KanbanBoard from '$lib/components/KanbanBoard.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import SubgoalCard from '$lib/components/SubgoalCard.svelte';
	import TaskDrawer from '$lib/components/TaskDrawer.svelte';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import { button, field, sectionHeading, segment } from '$lib/components/ui';
	import { dueLabel, dueTone, percent } from '$lib/format';
	import { stagger } from '$lib/motion';
	import { categoryColor } from '$lib/theme/category';

	let { data } = $props();

	let actionError = $state<unknown>(null);
	let busy = $state(false);
	let editing = $state(false);
	let confirmingDelete = $state(false);
	let deleteOrphanedTasks = $state(false);
	let view = $state<'list' | 'kanban'>('list');
	let editingTask = $state<TaskSummary | null>(null);
	let deletingTask = $state<TaskSummary | null>(null);
	let drawerOpen = $state(false);

	let newSubgoalTitle = $state('');
	let newSubgoalDue = $state('');
	let newTaskTitle = $state('');

	const accent = $derived(categoryColor(data.goal?.category?.colorToken));
	const boardTasks = $derived(
		data.goal ? [...data.goal.directTasks, ...data.goal.subgoals.flatMap((s) => s.tasks)] : []
	);
	/** Tasks that would otherwise silently become standalone once their subgoal is gone. */
	const subgoalTaskCount = $derived(
		data.goal?.subgoals.reduce((total, subgoal) => total + subgoal.tasks.length, 0) ?? 0
	);
	/** Habits among the direct tasks don't count toward the progress average, so
	 * they're left out of this count too — otherwise the copy claims more tasks
	 * were averaged than actually were. */
	const progressDirectTaskCount = $derived(
		data.goal?.directTasks.filter((task) => task.recurrence === null).length ?? 0
	);

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

	async function addSubgoal(event: SubmitEvent) {
		event.preventDefault();
		const title = newSubgoalTitle.trim();
		if (!data.goal || !title) return;

		const dueDate = newSubgoalDue || null;
		newSubgoalTitle = '';
		newSubgoalDue = '';
		await run(() => createSubgoal({ goalId: data.goal!.id, title, dueDate }));
	}

	async function addDirectTask(event: SubmitEvent) {
		event.preventDefault();
		const title = newTaskTitle.trim();
		if (!data.goal || !title) return;

		newTaskTitle = '';
		await run(() =>
			createTask({
				title,
				dueDate: null,
				goalId: data.goal!.id,
				subgoalId: null,
				recurrence: null
			})
		);
	}

	async function removeGoal() {
		if (!data.goal) return;
		busy = true;
		try {
			await deleteGoal(data.goal.id, deleteOrphanedTasks);
			await goto('/goals');
		} catch (error) {
			actionError = error;
			busy = false;
			confirmingDelete = false;
		}
	}

	async function removeTask() {
		const task = deletingTask;
		if (!task) return;
		deletingTask = null;
		await run(() => deleteTask(task.id));
	}

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
</script>

<svelte:head><title>{data.goal?.title ?? 'Goal'} · Mushpoint</title></svelte:head>

{#if data.error}
	<ErrorBanner error={data.error} />
{:else if data.goal}
	{@const goal = data.goal}

	<a
		href="/goals"
		class="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-content"
	>
		<Icon name="chevron-right" size={13} weight={2.4} class="rotate-180" /> Back to Goals
	</a>

	{#if actionError}
		<div class="mb-4">
			<ErrorBanner error={actionError} onDismiss={() => (actionError = null)} />
		</div>
	{/if}

	<div class="grid items-start gap-8 lg:grid-cols-[320px_1fr]">
		<div
			class="rounded-card border border-subtle bg-surface p-4.5 transition-[opacity,filter] duration-[var(--mp-duration-slow)] lg:sticky lg:top-0 {goal.status ===
			'archived'
				? 'opacity-75 grayscale-[0.4]'
				: ''}"
		>
			<div class="flex items-center justify-between gap-2">
				<span
					class="rounded-full bg-background px-2.5 py-1 text-2xs font-bold tracking-wider uppercase"
					style="color:{accent}"
				>
					{goal.category?.name ?? 'Uncategorized'}
				</span>
				<div class="flex shrink-0 gap-1">
					{#if goal.repoUrl}
						{@const repoUrl = goal.repoUrl}
						<button
							type="button"
							class={button.icon}
							onclick={() => openExternal(repoUrl).catch((e) => (actionError = e))}
						>
							<Icon name="github" size={14} label="Open repository" />
						</button>
					{/if}
					<button type="button" class={button.icon} onclick={() => (editing = true)}>
						<Icon name="edit" size={14} label="Edit goal" />
					</button>
					<button
						type="button"
						class={button.icon}
						disabled={busy}
						onclick={() => (confirmingDelete = true)}
					>
						<Icon name="trash" size={14} label="Delete goal" />
					</button>
				</div>
			</div>

			<h1 class="mt-3.5 mb-2 flex items-center gap-2 font-display text-2xl leading-tight font-bold">
				{#if goal.fromIdea}
					<span title="Promoted from an idea" class="shrink-0 text-muted">
						<Icon name="idea" size={18} />
					</span>
				{/if}
				{goal.title}
			</h1>

			<div class="mb-4 flex gap-2.5 text-xs text-muted">
				<span>{TIMEFRAME_LABELS[goal.timeframe]}</span>
				<span aria-hidden="true">·</span>
				<span class={dueTone(goal.dueDate) === 'overdue' ? 'font-semibold text-warn' : ''}>
					{dueLabel(goal.dueDate)}
				</span>
			</div>

			<ProgressBar
				value={goal.progress}
				label="{goal.title} progress"
				showValue={false}
				color={accent}
			/>
			<p class="mt-2 mb-3 text-xs text-muted">
				{percent(goal.progress)} complete · averaged across {goal.subgoals.length} subgoals and {progressDirectTaskCount}
				direct tasks
			</p>

			<div class="mb-5">
				<GoalStatusSegment
					goalId={goal.id}
					title={goal.title}
					status={goal.status}
					progress={goal.progress}
					onMutated={invalidateAll}
					onError={(error) => (actionError = error)}
				/>
			</div>

			<div class="border-t border-subtle pt-4">
				<h2 class="mb-2 text-2xs font-semibold tracking-[0.06em] text-muted uppercase">
					Motivation
				</h2>
				{#if goal.motivationText}
					<p class="text-md leading-relaxed italic">“{goal.motivationText}”</p>
				{:else}
					<p class="text-sm text-muted">No motivation yet — edit the goal to say why it matters.</p>
				{/if}

				{#if goal.description}
					<h2 class="mt-4 mb-2 text-2xs font-semibold tracking-[0.06em] text-muted uppercase">
						Description
					</h2>
					<p class="text-md leading-relaxed">{goal.description}</p>
				{/if}
			</div>
		</div>

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

					<div class="mb-4 flex flex-col gap-2.5">
						{#each goal.subgoals as subgoal, index (subgoal.id)}
							<div class="mp-enter" style="--mp-delay:{stagger(index)}">
								<SubgoalCard
									{subgoal}
									onMutated={invalidateAll}
									onError={(error) => (actionError = error)}
								/>
							</div>
						{/each}
					</div>

					<form class="flex gap-2" onsubmit={addSubgoal}>
						<input
							class="{field.dashed} min-w-0 flex-1"
							bind:value={newSubgoalTitle}
							placeholder="+ Add subgoal…"
							aria-label="New subgoal"
						/>
						<DatePicker
							bind:value={newSubgoalDue}
							ariaLabel="New subgoal due date"
							dashed
							class="w-37.5 shrink-0"
						/>
					</form>
				</section>

				<section>
					<h2 class="{sectionHeading} mb-1.5">Direct tasks</h2>
					<p class="mb-3.5 text-sm text-muted">
						Tasks linked straight to the goal. Each one counts as much as a whole subgoal.
					</p>

					{#if goal.directTasks.length > 0}
						<ul class="mb-3 flex flex-col rounded-card border border-subtle bg-surface px-4 py-2.5">
							{#each goal.directTasks as task (task.id)}
								<TaskRow
									{task}
									onMutated={invalidateAll}
									onError={(error) => (actionError = error)}
								/>
							{/each}
						</ul>
					{/if}

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
					parentChipMode="subgoal-only"
					onMutated={invalidateAll}
					onError={(error) => (actionError = error)}
					onEditTask={editTask}
					onDeleteTask={(task) => (deletingTask = task)}
				/>
			{/if}
		</div>
	</div>

	<GoalDrawer
		open={editing}
		categories={data.categories}
		{goal}
		onClose={() => (editing = false)}
		onSaved={invalidateAll}
	/>

	<TaskDrawer
		open={drawerOpen}
		goals={data.goals}
		subgoals={data.subgoals}
		task={editingTask}
		onClose={() => (drawerOpen = false)}
		onSaved={invalidateAll}
	/>

	<ConfirmDialog
		open={confirmingDelete}
		title="Delete “{goal.title}”?"
		body="This also removes {goal.subgoals
			.length} subgoal(s). Tasks linked directly to the goal stay, unlinked. This cannot be undone."
		{busy}
		onConfirm={removeGoal}
		onCancel={() => {
			confirmingDelete = false;
			deleteOrphanedTasks = false;
		}}
	>
		{#if subgoalTaskCount > 0}
			<Checkbox
				checked={deleteOrphanedTasks}
				label="Also delete {subgoalTaskCount} {subgoalTaskCount === 1
					? 'task'
					: 'tasks'} from its subgoals, instead of leaving them standalone"
				showLabel
				disabled={busy}
				onchange={(checked) => (deleteOrphanedTasks = checked)}
			/>
		{/if}
	</ConfirmDialog>

	<ConfirmDialog
		open={deletingTask !== null}
		title="Delete “{deletingTask?.title ?? ''}”?"
		body="The task is removed from the board. This cannot be undone."
		{busy}
		onConfirm={removeTask}
		onCancel={() => (deletingTask = null)}
	/>
{/if}
