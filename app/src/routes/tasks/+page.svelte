<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { deleteTask, setTaskCompletion, type TaskSummary } from '$lib/api';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import KanbanBoard from '$lib/components/KanbanBoard.svelte';
	import StreakCard from '$lib/components/StreakCard.svelte';
	import TaskDrawer from '$lib/components/TaskDrawer.svelte';
	import { button, sectionHeading } from '$lib/components/ui';

	let { data } = $props();

	let drawerOpen = $state(false);
	let editingTask = $state<TaskSummary | null>(null);
	let deletingTask = $state<TaskSummary | null>(null);
	let busy = $state(false);
	let actionError = $state<unknown>(null);

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

	async function toggleToday(task: { id: number }, done: boolean) {
		await run(() => setTaskCompletion(task.id, done));
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
