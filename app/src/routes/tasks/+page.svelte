<script lang="ts">
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { deleteTask, setTaskCompletion, type TaskSummary } from '$lib/api';
	import CalendarView from '$lib/components/tasks/CalendarView.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ErrorBanner from 'mushpoint-design/svelte/ErrorBanner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import KanbanBoard from '$lib/components/tasks/KanbanBoard.svelte';
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import SectionHeader from 'mushpoint-design/svelte/SectionHeader.svelte';
	import { withTodayDone } from '$lib/streakToggle';
	import StreakRow from '$lib/components/streaks/StreakRow.svelte';
	import TaskListView from '$lib/components/tasks/TaskListView.svelte';
	import TaskDrawer from '$lib/components/tasks/TaskDrawer.svelte';
	import { tabId, tabPanelId } from '$lib/components/ui/tabIds';
	import Tabs from '$lib/components/ui/Tabs.svelte';
	import { button } from '$lib/components/ui';
	import { taskColumn } from '$lib/kanban';
	import { optimistic } from '$lib/optimistic';

	let { data } = $props();

	let drawerOpen = $state(false);
	let editingTask = $state<TaskSummary | null>(null);
	let newTaskDue = $state<string | null>(null);
	let deletingTask = $state<TaskSummary | null>(null);
	let busy = $state(false);
	let actionError = $state<unknown>(null);
	const TASK_VIEWS = [
		{ value: 'list', label: 'List' },
		{ value: 'board', label: 'Board' },
		{ value: 'calendar', label: 'Calendar' }
	] as const;
	type TaskView = (typeof TASK_VIEWS)[number]['value'];
	let view = $state<TaskView>('list');

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

	/** Streak ticks the user just made, shown until fresh data arrives. */
	let pendingToday = $state<Record<number, boolean>>({});

	function toggleToday(task: { id: number }, done: boolean) {
		actionError = null;
		return optimistic({
			key: `task:${task.id}`,
			apply: () => (pendingToday[task.id] = done),
			revert: () => delete pendingToday[task.id],
			call: () => setTaskCompletion(task.id, done),
			refresh: invalidateAll,
			onError: (error) => (actionError = error),
			settle: () => delete pendingToday[task.id]
		});
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

	function newTask(dueDate: string | null = null) {
		editingTask = null;
		newTaskDue = dueDate;
		drawerOpen = true;
	}

	// A UI display preference only — not domain data, so it never touches the
	// backend. Same reasoning as the goal-detail List/Kanban toggle.
	$effect(() => {
		if (!browser) return;
		const stored = localStorage.getItem('mp-tasks-view');
		view = stored === 'calendar' || stored === 'board' ? stored : 'list';
	});

	function setView(next: TaskView) {
		view = next;
		if (browser) localStorage.setItem('mp-tasks-view', next);
	}
</script>

<svelte:head><title>Tasks · Mushpoint</title></svelte:head>

<PageHeader title="Tasks">
	{#snippet actions()}
		<button type="button" class="{button.primary} shrink-0" onclick={() => newTask()}>
			<Icon name="plus" size={15} weight={2.4} />
			New Task
		</button>
	{/snippet}
</PageHeader>

{#if data.error}
	<div class="page-gutter pb-4"><ErrorBanner error={data.error} /></div>
{/if}
{#if actionError}
	<div class="page-gutter pb-4">
		<ErrorBanner error={actionError} onDismiss={() => (actionError = null)} />
	</div>
{/if}

<section class="section-gutter border-b border-subtle [&>:first-child]:border-b-0">
	<SectionHeader title="Streaks" />
	{#if data.streaks.length === 0}
		<p class="page-gutter py-3 text-sm text-muted">No habits tracked yet.</p>
	{:else}
		<ul class="flex flex-wrap gap-3 page-gutter py-3">
			{#each data.streaks as card (card.task.id)}
				<StreakRow
					card={card.task.id in pendingToday
						? withTodayDone(card, pendingToday[card.task.id])
						: card}
					onToggle={(done) => toggleToday(card.task, done)}
				/>
			{/each}
		</ul>
	{/if}
</section>

<Tabs
	id="tasks-view"
	label="Task view"
	tabs={TASK_VIEWS}
	value={view}
	onChange={setView}
	class="page-margin mt-4 mb-4"
/>

<div
	role="tabpanel"
	id={tabPanelId('tasks-view', view)}
	aria-labelledby={tabId('tasks-view', view)}
	class={view === 'list' ? '' : 'page-gutter pb-6'}
>
	{#if view === 'list'}
		<TaskListView
			tasks={data.tasks}
			goals={data.goals}
			subgoals={data.subgoals}
			onMutated={invalidateAll}
			onError={(error) => (actionError = error)}
			onEditTask={edit}
			onDeleteTask={(task) => (deletingTask = task)}
		/>
	{:else if view === 'board'}
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
			onCreateTask={newTask}
		/>
	{/if}
</div>

<TaskDrawer
	open={drawerOpen}
	goals={data.goals}
	subgoals={data.subgoals}
	task={editingTask}
	prefillDueDate={newTaskDue}
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
