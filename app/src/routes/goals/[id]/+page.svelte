<script lang="ts">
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import {
		createSubgoal,
		createTask,
		deleteGoal,
		deleteTask,
		RECURRENCE_OPTIONS,
		TIMEFRAME_LABELS,
		type Recurrence,
		type Subgoal,
		type TaskSummary
	} from '$lib/api';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ErrorBanner from 'mushpoint-design/svelte/ErrorBanner.svelte';
	import Checkbox from 'mushpoint-design/svelte/Checkbox.svelte';
	import DatePicker from 'mushpoint-design/svelte/DatePicker.svelte';
	import GanttChart from '$lib/components/tasks/GanttChart.svelte';
	import GoalDrawer from '$lib/components/goals/GoalDrawer.svelte';
	import GoalStatusSegment from '$lib/components/goals/GoalStatusSegment.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import KanbanBoard from '$lib/components/tasks/KanbanBoard.svelte';
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import ProgressBar from 'mushpoint-design/svelte/ProgressBar.svelte';
	import SectionHeader from 'mushpoint-design/svelte/SectionHeader.svelte';
	import Stat from 'mushpoint-design/svelte/Stat.svelte';
	import Select from 'mushpoint-design/svelte/Select.svelte';
	import SubgoalRow from '$lib/components/goals/SubgoalRow.svelte';
	import SubgoalDrawer from '$lib/components/goals/SubgoalDrawer.svelte';
	import TaskDrawer from '$lib/components/tasks/TaskDrawer.svelte';
	import TaskRow from '$lib/components/tasks/TaskRow.svelte';
	import { tabId, tabPanelId } from '$lib/components/ui/tabIds';
	import Tabs from '$lib/components/ui/Tabs.svelte';
	import { button, field } from '$lib/components/ui';
	import { dueLabel, percent, safeHref } from '$lib/format';
	import { goalStats } from '$lib/goalStats';
	import { stagger } from '$lib/motion';
	import { categoryColor } from '$lib/theme/category';

	type GoalView = 'list' | 'kanban' | 'timeline';
	const GOAL_VIEWS: { value: GoalView; label: string }[] = [
		{ value: 'list', label: 'List' },
		{ value: 'kanban', label: 'Kanban' },
		{ value: 'timeline', label: 'Timeline' }
	];

	let { data } = $props();

	let actionError = $state<unknown>(null);
	let busy = $state(false);
	let editing = $state(false);
	let confirmingDelete = $state(false);
	let deleteOrphanedTasks = $state(false);
	let view = $state<GoalView>('list');
	let editingSubgoal = $state<Subgoal | null>(null);
	let editingTask = $state<TaskSummary | null>(null);
	let deletingTask = $state<TaskSummary | null>(null);
	let drawerOpen = $state(false);

	let newSubgoalTitle = $state('');
	let newSubgoalDue = $state('');
	let newTaskTitle = $state('');
	let newTaskRecurrence = $state('');

	const accent = $derived(categoryColor(data.goal?.category?.colorToken));
	const boardTasks = $derived(
		data.goal ? [...data.goal.directTasks, ...data.goal.subgoals.flatMap((s) => s.tasks)] : []
	);
	/** Archived goals read dimmed. Only static summary blocks get the filter: it makes a
	 * containing block for fixed descendants, so never wrap the task views or popups. */
	const dim = $derived(
		`transition-[opacity,filter] duration-[var(--mp-duration-slow)] ${
			data.goal?.status === 'archived' ? 'opacity-75 grayscale-[0.4]' : ''
		}`
	);
	const stats = $derived(
		data.goal
			? goalStats(data.goal, data.goal.subgoals, boardTasks)
			: goalStats({ progress: 0 }, [], [])
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

		const recurrence = (newTaskRecurrence || null) as Recurrence | null;
		newTaskTitle = '';
		newTaskRecurrence = '';
		await run(() =>
			createTask({
				title,
				dueDate: null,
				goalId: data.goal!.id,
				subgoalId: null,
				recurrence
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
		view = stored === 'kanban' || stored === 'timeline' ? stored : 'list';
	});

	function setView(next: GoalView) {
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
	<div class="px-4 pt-5 md:px-8"><ErrorBanner error={data.error} /></div>
{:else if data.goal}
	{@const goal = data.goal}

	<div>
		<div class={dim}>
			<div class="px-4 pt-4 md:px-8">
				<a
					href="/goals"
					class="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-content"
				>
					<Icon name="chevron-right" size={13} weight={2.4} class="rotate-180" /> Back to Goals
				</a>
			</div>

			<PageHeader
				title={goal.title}
				subtitle={[
					goal.category?.name ?? 'Uncategorized',
					TIMEFRAME_LABELS[goal.timeframe],
					dueLabel(goal.dueDate),
					goal.fromIdea ? 'Promoted from an idea' : ''
				]
					.filter(Boolean)
					.join(' · ')}
			>
				{#snippet actions()}
					{#if safeHref(goal.repoUrl)}
						<a
							href={safeHref(goal.repoUrl)}
							target="_blank"
							rel="noopener noreferrer"
							class="{button.icon} mp-hit"
						>
							<Icon name="github" size={14} label="Open repository" />
						</a>
					{/if}
					<button type="button" class="{button.icon} mp-hit" onclick={() => (editing = true)}>
						<Icon name="edit" size={14} label="Edit goal" />
					</button>
					<button
						type="button"
						class="{button.icon} mp-hit"
						disabled={busy}
						onclick={() => (confirmingDelete = true)}
					>
						<Icon name="trash" size={14} label="Delete goal" />
					</button>
				{/snippet}
			</PageHeader>
		</div>

		{#if actionError}
			<div class="px-4 pb-4 md:px-8">
				<ErrorBanner error={actionError} onDismiss={() => (actionError = null)} />
			</div>
		{/if}

		<div
			class="grid grid-cols-2 gap-4 px-4 pb-4 md:flex md:gap-12 md:px-8 {dim}"
			role="group"
			aria-label="Summary"
		>
			<Stat label="Progress" value="{stats.progressPct}%" />
			<Stat label="Subgoals done" value="{stats.subgoalsDone}/{stats.subgoalsTotal}" />
			<Stat label="Tasks done" value="{stats.tasksDone}/{stats.tasksTotal}" />
			<Stat label="Due" value={goal.dueDate ? dueLabel(goal.dueDate) : 'None'} />
		</div>

		<div class="border-b border-subtle px-4 pb-4 md:px-8">
			<ProgressBar
				value={goal.progress}
				label="{goal.title} progress"
				showValue={false}
				color={accent}
			/>
			<p class="mt-2 text-xs text-muted">
				{percent(goal.progress)} complete · averaged across {goal.subgoals.length} subgoals and {progressDirectTaskCount}
				direct tasks
			</p>
			<div class="mt-3 max-w-sm">
				<GoalStatusSegment
					goalId={goal.id}
					title={goal.title}
					status={goal.status}
					progress={goal.progress}
					onMutated={invalidateAll}
					onError={(error) => (actionError = error)}
				/>
			</div>
		</div>

		<section class="border-b border-subtle pb-4 {dim}">
			<SectionHeader title="Motivation" />
			<div class="px-4 pt-3 md:px-8">
				{#if goal.motivationText}
					<p class="text-md leading-relaxed italic">“{goal.motivationText}”</p>
				{:else}
					<p class="text-sm text-muted">No motivation yet — edit the goal to say why it matters.</p>
				{/if}
				{#if goal.description}
					<h2 class="mt-4 mb-1 text-xs font-semibold tracking-[0.06em] text-muted uppercase">
						Description
					</h2>
					<p class="text-md leading-relaxed">{goal.description}</p>
				{/if}
			</div>
		</section>

		<Tabs
			id="goal-view"
			label="Goal view"
			tabs={GOAL_VIEWS}
			value={view}
			onChange={setView}
			class="mx-4 mt-4 mb-4 md:mx-8"
		/>

		<div
			role="tabpanel"
			id={tabPanelId('goal-view', view)}
			aria-labelledby={tabId('goal-view', view)}
			class={view === 'list' ? '' : 'px-4 pb-6 md:px-8'}
		>
			{#if view === 'list'}
				<section class="border-b border-subtle pb-4">
					<SectionHeader title="Subgoals" count={goal.subgoals.length} />
					<p class="px-4 pt-3 pb-2 text-sm text-muted md:px-8">
						Milestones toward the goal — each one can hold its own tasks and due date.
					</p>

					<div class="px-4 md:px-8">
						{#if goal.subgoals.length === 0}
							<p class="py-2 text-sm text-muted">No subgoals yet.</p>
						{:else}
							<ul class="divide-y divide-subtle" aria-label="Subgoals">
								{#each goal.subgoals as subgoal, index (subgoal.id)}
									<SubgoalRow
										{subgoal}
										onMutated={invalidateAll}
										onError={(error) => (actionError = error)}
										onEdit={() => (editingSubgoal = subgoal)}
										delay={stagger(index)}
									/>
								{/each}
							</ul>
						{/if}

						<form class="mt-3 flex gap-2" onsubmit={addSubgoal}>
							<input
								class="{field.dashed} max-w-100 min-w-0 flex-1"
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
					</div>
				</section>

				<section class="pb-4">
					<SectionHeader title="Direct tasks" count={goal.directTasks.length} />
					<p class="px-4 pt-3 pb-2 text-sm text-muted md:px-8">
						Tasks linked straight to the goal. Each one counts as much as a whole subgoal.
					</p>

					<div class="px-4 md:px-8">
						{#if goal.directTasks.length > 0}
							<ul class="mb-3 flex flex-col">
								{#each goal.directTasks as task (task.id)}
									<TaskRow
										{task}
										onMutated={invalidateAll}
										onError={(error) => (actionError = error)}
									/>
								{/each}
							</ul>
						{:else}
							<p class="mb-3 text-sm text-muted">No direct tasks yet.</p>
						{/if}

						<form class="flex gap-2" onsubmit={addDirectTask}>
							<input
								class="{field.dashed} min-w-0 flex-1"
								bind:value={newTaskTitle}
								placeholder="+ Add a task…"
								aria-label="New direct task"
							/>
							<Select
								class="w-37.5 shrink-0"
								ariaLabel="New direct task repeats"
								bind:value={newTaskRecurrence}
								options={RECURRENCE_OPTIONS}
							/>
						</form>
					</div>
				</section>
			{:else if view === 'timeline'}
				<GanttChart {goal} />
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

	<SubgoalDrawer
		subgoal={editingSubgoal}
		onClose={() => (editingSubgoal = null)}
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
