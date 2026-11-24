<script lang="ts">
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import {
		createSubgoal,
		createTask,
		deleteGoal,
		deleteTask,
		RECURRENCE_OPTIONS,
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
	import GoalNote from '$lib/components/goals/GoalNote.svelte';
	import GoalStatusControl from '$lib/components/goals/GoalStatusControl.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import KanbanBoard from '$lib/components/tasks/KanbanBoard.svelte';
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import ProgressBar from 'mushpoint-design/svelte/ProgressBar.svelte';
	import Select from 'mushpoint-design/svelte/Select.svelte';
	import SubgoalRow from '$lib/components/goals/SubgoalRow.svelte';
	import SubgoalDrawer from '$lib/components/goals/SubgoalDrawer.svelte';
	import TaskDrawer from '$lib/components/tasks/TaskDrawer.svelte';
	import TaskRow from '$lib/components/tasks/TaskRow.svelte';
	import { tabId, tabPanelId } from '$lib/components/ui/tabIds';
	import Tabs from '$lib/components/ui/Tabs.svelte';
	import { button, field } from '$lib/components/ui';
	import { dueLabel, safeHref } from '$lib/format';
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
	<div class="page-gutter pt-5 md:pt-7"><ErrorBanner error={data.error} /></div>
{:else if data.goal}
	{@const goal = data.goal}

	<div>
		<!-- Not dimmed: the status control's dialogs are fixed-position, and a filter
		     on an ancestor would trap them. The summary and note below dim instead. -->
		<div>
			<div class="page-gutter pt-5 md:pt-7">
				<a
					href="/goals"
					class="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-content"
				>
					<Icon name="chevron-right" size={13} weight={2.4} class="rotate-180" /> Back to Goals
				</a>
			</div>

			<PageHeader
				title={goal.title}
				subtitle={goal.fromIdea ? 'Promoted from an idea' : undefined}
				flush
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
					<GoalStatusControl
						goalId={goal.id}
						title={goal.title}
						status={goal.status}
						progress={goal.progress}
						onEdit={() => (editing = true)}
						onDelete={() => (confirmingDelete = true)}
						onMutated={invalidateAll}
						onError={(error) => (actionError = error)}
					/>
				{/snippet}
			</PageHeader>
		</div>

		{#if actionError}
			<div class="page-gutter pb-4">
				<ErrorBanner error={actionError} onDismiss={() => (actionError = null)} />
			</div>
		{/if}

		<div class="mb-6 border-b border-subtle pb-6 {dim}" role="group" aria-label="Summary">
			<div class="page-gutter">
				<div class="flex items-end gap-6">
					<dl class="flex shrink-0 flex-col gap-0.5">
						<dt class="text-xs text-muted">Progress</dt>
						<dd class="m-0 font-display text-4xl leading-none font-bold tabular-nums">
							{stats.progressPct}%
						</dd>
					</dl>
					<div class="min-w-0 flex-1 pb-1.5">
						<ProgressBar
							value={goal.progress}
							label="{goal.title} progress"
							showValue={false}
							height={8}
							color={accent}
						/>
					</div>
				</div>
				<dl class="mt-4 flex flex-wrap gap-x-10 gap-y-3">
					<div class="flex flex-col gap-0.5">
						<dt class="text-xs text-muted">Subgoals done</dt>
						<dd class="m-0 text-md font-semibold tabular-nums">
							{stats.subgoalsDone}/{stats.subgoalsTotal}
						</dd>
					</div>
					<div class="flex flex-col gap-0.5">
						<dt class="text-xs text-muted">Tasks done</dt>
						<dd class="m-0 text-md font-semibold tabular-nums">
							{stats.tasksDone}/{stats.tasksTotal}
						</dd>
					</div>
					<div class="flex flex-col gap-0.5">
						<dt class="text-xs text-muted">Due</dt>
						<dd class="m-0 text-md font-semibold">
							{goal.dueDate ? dueLabel(goal.dueDate) : 'None'}
						</dd>
					</div>
				</dl>
			</div>
		</div>

		<div
			class="page-gutter pb-8 {view === 'list'
				? 'flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start lg:gap-14'
				: ''}"
		>
			{#if view === 'list'}
				<GoalNote
					class="{dim} lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1"
					motivation={goal.motivationText}
					description={goal.description}
					onEdit={() => (editing = true)}
				/>
			{/if}

			<div class="min-w-0 lg:col-start-1 lg:row-start-1">
				<Tabs
					id="goal-view"
					label="Goal view"
					tabs={GOAL_VIEWS}
					value={view}
					onChange={setView}
					class="mb-6"
				/>

				<div
					role="tabpanel"
					id={tabPanelId('goal-view', view)}
					aria-labelledby={tabId('goal-view', view)}
				>
					{#if view === 'list'}
						<section aria-label="Subgoals">
							<h2 class="flex items-baseline gap-2 text-sm font-semibold">
								Subgoals
								<span class="text-xs font-semibold text-faint tabular-nums">
									{goal.subgoals.length}
								</span>
							</h2>

							{#if goal.subgoals.length === 0}
								<p class="pt-2 text-sm text-muted">
									Milestones toward the goal — each can hold its own tasks and due date.
								</p>
							{:else}
								<ul class="mt-2 divide-y divide-subtle" aria-label="Subgoals">
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

							<form class="mt-3 flex max-w-xl gap-2" onsubmit={addSubgoal}>
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

						<section class="mt-10" aria-label="Direct tasks">
							<h2 class="flex items-baseline gap-2 text-sm font-semibold">
								Direct tasks
								<span class="text-xs font-semibold text-faint tabular-nums">
									{goal.directTasks.length}
								</span>
							</h2>

							{#if goal.directTasks.length > 0}
								<ul class="mt-2 mb-3 flex flex-col">
									{#each goal.directTasks as task (task.id)}
										<TaskRow
											{task}
											onMutated={invalidateAll}
											onError={(error) => (actionError = error)}
										/>
									{/each}
								</ul>
							{:else}
								<p class="pt-2 pb-3 text-sm text-muted">
									Tasks linked straight to the goal. Each counts as much as a whole subgoal.
								</p>
							{/if}

							<form class="flex max-w-xl gap-2" onsubmit={addDirectTask}>
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
