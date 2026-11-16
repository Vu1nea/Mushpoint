<script lang="ts">
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { deleteTask, setTaskCompletion, type TaskSummary } from '$lib/api';
	import CalendarView from '$lib/components/CalendarView.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import KanbanBoard from '$lib/components/KanbanBoard.svelte';
	import StreakCard from '$lib/components/StreakCard.svelte';
	import TaskDrawer from '$lib/components/TaskDrawer.svelte';
	import { tabId, tabPanelId } from '$lib/components/tabIds';
	import Tabs from '$lib/components/Tabs.svelte';
	import { button, sectionHeading } from '$lib/components/ui';
	import { optimistic } from '$lib/optimistic';

	let { data } = $props();

	let drawerOpen = $state(false);
	let editingTask = $state<TaskSummary | null>(null);
	let newTaskDue = $state<string | null>(null);
	let deletingTask = $state<TaskSummary | null>(null);
	let busy = $state(false);
	let actionError = $state<unknown>(null);
	const TASK_VIEWS = [
		{ value: 'board', label: 'Board' },
		{ value: 'calendar', label: 'Calendar' }
	] as const;
	let view = $state<'board' | 'calendar'>('board');

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
		view = stored === 'calendar' ? 'calendar' : 'board';
	});

	function setView(next: 'board' | 'calendar') {
		view = next;
		if (browser) localStorage.setItem('mp-tasks-view', next);
	}
</script>

<svelte:head><title>Tasks · Mushpoint</title></svelte:head>

<header class="mb-6 flex items-start justify-between gap-4">
	<div>
		<h1 class="mb-1 font-display text-3xl font-bold">Tasks</h1>
		<p class="text-sm text-muted">Everything on your plate</p>
	</div>
	<button type="button" class={button.primary} onclick={() => newTask()}>
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
				<StreakCard
					card={card.task.id in pendingToday
						? { ...card, doneToday: pendingToday[card.task.id] }
						: card}
					onToggle={(done) => toggleToday(card.task, done)}
				/>
			{/each}
		</div>
	</section>
{/if}

<Tabs
	id="tasks-view"
	label="Task view"
	tabs={TASK_VIEWS}
	value={view}
	onChange={setView}
	class="mb-5"
/>

<div
	role="tabpanel"
	id={tabPanelId('tasks-view', view)}
	aria-labelledby={tabId('tasks-view', view)}
>
	{#if view === 'board'}
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
