<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import {
		createSubgoal,
		createTask,
		deleteGoal,
		GOAL_STATUS_LABELS,
		setGoalStatus,
		TIMEFRAME_LABELS,
		TIMEFRAMES,
		updateGoal,
		type GoalStatus,
		type Timeframe
	} from '$lib/api';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import SubgoalCard from '$lib/components/SubgoalCard.svelte';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import { button, card, field } from '$lib/components/ui';
	import { dueLabel, isOverdue } from '$lib/format';

	let { data } = $props();

	let actionError = $state<unknown>(null);
	let busy = $state(false);
	let editing = $state(false);

	let newSubgoalTitle = $state('');
	let newTaskTitle = $state('');

	// Edit-form state, refilled whenever a different goal loads.
	let form = $state({
		title: '',
		timeframe: 'mid' as Timeframe,
		categoryId: '',
		dueDate: '',
		description: '',
		motivationText: ''
	});

	$effect(() => {
		const goal = data.goal;
		if (!goal) return;
		form = {
			title: goal.title,
			timeframe: goal.timeframe,
			categoryId: goal.categoryId ? String(goal.categoryId) : '',
			dueDate: goal.dueDate ?? '',
			description: goal.description ?? '',
			motivationText: goal.motivationText ?? ''
		};
	});

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

	async function saveEdits(event: SubmitEvent) {
		event.preventDefault();
		if (!data.goal) return;

		await run(() =>
			updateGoal(data.goal!.id, {
				categoryId: form.categoryId ? Number(form.categoryId) : null,
				title: form.title,
				description: form.description || null,
				timeframe: form.timeframe,
				dueDate: form.dueDate || null,
				motivationText: form.motivationText || null,
				motivationImagePath: data.goal!.motivationImagePath
			})
		);
		if (!actionError) editing = false;
	}

	async function addSubgoal(event: SubmitEvent) {
		event.preventDefault();
		if (!data.goal) return;
		const title = newSubgoalTitle;
		newSubgoalTitle = '';
		await run(() => createSubgoal({ goalId: data.goal!.id, title, dueDate: null }));
	}

	async function addDirectTask(event: SubmitEvent) {
		event.preventDefault();
		if (!data.goal) return;
		const title = newTaskTitle;
		newTaskTitle = '';
		await run(() =>
			createTask({
				title,
				dueDate: null,
				goalId: data.goal!.id,
				subgoalId: null,
				isRecurring: false
			})
		);
	}

	async function changeStatus(status: GoalStatus) {
		if (!data.goal) return;
		await run(() => setGoalStatus(data.goal!.id, status));
	}

	async function removeGoal() {
		if (!data.goal) return;
		if (!confirm(`Delete “${data.goal.title}” and its subgoals? This cannot be undone.`)) return;

		busy = true;
		try {
			await deleteGoal(data.goal.id);
			await goto('/goals');
		} catch (error) {
			actionError = error;
			busy = false;
		}
	}
</script>

<svelte:head><title>{data.goal?.title ?? 'Goal'} · Mushpoint</title></svelte:head>

{#if data.error}
	<ErrorBanner error={data.error} />
{:else if data.goal}
	{@const goal = data.goal}

	<a
		href="/goals"
		class="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-content"
	>
		<Icon name="chevron-right" size={14} class="rotate-180" /> All goals
	</a>

	<header class="mb-6 flex flex-wrap items-start justify-between gap-4">
		<div class="min-w-0">
			<div class="flex flex-wrap items-center gap-2">
				<h1 class="truncate text-2xl font-semibold">{goal.title}</h1>
				<span class="rounded-full border border-subtle px-2 py-0.5 text-xs text-muted">
					{TIMEFRAME_LABELS[goal.timeframe]}
				</span>
				<span class="rounded-full border border-subtle px-2 py-0.5 text-xs text-muted">
					{GOAL_STATUS_LABELS[goal.status]}
				</span>
				{#if goal.category}
					<span class="text-xs text-accent">{goal.category.name}</span>
				{/if}
			</div>
			<p class="mt-1 text-sm {isOverdue(goal.dueDate) ? 'text-danger' : 'text-muted'}">
				{dueLabel(goal.dueDate)}
			</p>
		</div>

		<div class="flex flex-wrap gap-2">
			<button type="button" class={button.ghost} onclick={() => (editing = !editing)}>
				<Icon name={editing ? 'close' : 'edit'} size={15} />
				{editing ? 'Cancel' : 'Edit'}
			</button>
			{#if goal.status === 'active'}
				<button
					type="button"
					class={button.ghost}
					disabled={busy}
					onclick={() => changeStatus('completed')}
				>
					<Icon name="check" size={15} /> Complete
				</button>
				<button
					type="button"
					class={button.ghost}
					disabled={busy}
					onclick={() => changeStatus('archived')}
				>
					Archive
				</button>
			{:else}
				<button
					type="button"
					class={button.ghost}
					disabled={busy}
					onclick={() => changeStatus('active')}
				>
					Reactivate
				</button>
			{/if}
			<button type="button" class={button.danger} disabled={busy} onclick={removeGoal}>
				<Icon name="trash" size={15} /> Delete
			</button>
		</div>
	</header>

	{#if actionError}
		<div class="mb-4">
			<ErrorBanner error={actionError} onDismiss={() => (actionError = null)} />
		</div>
	{/if}

	<div class="{card} mb-6">
		<p class="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Progress</p>
		<ProgressBar value={goal.progress} label="{goal.title} progress" />
		<p class="mt-2 text-xs text-muted">
			Averaged across {goal.subgoals.length} subgoals and {goal.directTasks.length} direct tasks.
		</p>
	</div>

	{#if editing}
		<form class="{card} mb-6 grid gap-4 sm:grid-cols-2" onsubmit={saveEdits}>
			<div class="sm:col-span-2">
				<label class={field.label} for="edit-title">Title</label>
				<input id="edit-title" class={field.input} bind:value={form.title} required />
			</div>

			<div>
				<label class={field.label} for="edit-timeframe">Timeframe</label>
				<select id="edit-timeframe" class={field.input} bind:value={form.timeframe}>
					{#each TIMEFRAMES as option (option)}
						<option value={option}>{TIMEFRAME_LABELS[option]}</option>
					{/each}
				</select>
			</div>

			<div>
				<label class={field.label} for="edit-category">Category</label>
				<select id="edit-category" class={field.input} bind:value={form.categoryId}>
					<option value="">Uncategorized</option>
					{#each data.categories as category (category.id)}
						<option value={String(category.id)}>{category.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label class={field.label} for="edit-due">Due date</label>
				<input id="edit-due" type="date" class={field.input} bind:value={form.dueDate} />
			</div>

			<div>
				<label class={field.label} for="edit-motivation">Motivation</label>
				<input id="edit-motivation" class={field.input} bind:value={form.motivationText} />
			</div>

			<div class="sm:col-span-2">
				<label class={field.label} for="edit-description">Description</label>
				<textarea id="edit-description" class={field.input} rows="2" bind:value={form.description}
				></textarea>
			</div>

			<div class="flex justify-end sm:col-span-2">
				<button type="submit" class={button.primary} disabled={busy}>Save changes</button>
			</div>
		</form>
	{:else if goal.motivationText || goal.description}
		<div class="{card} mb-6 grid gap-3">
			{#if goal.motivationText}
				<div>
					<p class="text-xs font-medium tracking-wide text-muted uppercase">Motivation</p>
					<p class="mt-1 text-sm">{goal.motivationText}</p>
				</div>
			{/if}
			{#if goal.description}
				<div>
					<p class="text-xs font-medium tracking-wide text-muted uppercase">Description</p>
					<p class="mt-1 text-sm">{goal.description}</p>
				</div>
			{/if}
		</div>
	{/if}

	<section class="mb-8">
		<h2 class="mb-3 text-lg font-medium">Subgoals</h2>

		{#if goal.subgoals.length === 0}
			<EmptyState
				icon="task"
				title="No subgoals yet"
				hint="Break the goal into a few key results."
			/>
		{:else}
			<div class="grid gap-3">
				{#each goal.subgoals as subgoal (subgoal.id)}
					<SubgoalCard
						{subgoal}
						onMutated={invalidateAll}
						onError={(error) => (actionError = error)}
					/>
				{/each}
			</div>
		{/if}

		<form class="mt-3 flex gap-2" onsubmit={addSubgoal}>
			<input
				class="{field.input} py-1.5 text-sm"
				bind:value={newSubgoalTitle}
				placeholder="Add a subgoal"
				required
				aria-label="New subgoal"
			/>
			<button type="submit" class={button.ghost} disabled={busy}>
				<Icon name="plus" size={15} /> Add
			</button>
		</form>
	</section>

	<section>
		<h2 class="mb-1 text-lg font-medium">Direct tasks</h2>
		<p class="mb-3 text-sm text-muted">
			Tasks linked straight to the goal. Each one counts as much as a whole subgoal.
		</p>

		{#if goal.directTasks.length === 0}
			<EmptyState
				icon="task"
				title="No direct tasks"
				hint="Add one for work that needs no subgoal."
			/>
		{:else}
			<ul class="{card} grid">
				{#each goal.directTasks as task (task.id)}
					<TaskRow {task} onMutated={invalidateAll} onError={(error) => (actionError = error)} />
				{/each}
			</ul>
		{/if}

		<form class="mt-3 flex gap-2" onsubmit={addDirectTask}>
			<input
				class="{field.input} py-1.5 text-sm"
				bind:value={newTaskTitle}
				placeholder="Add a task"
				required
				aria-label="New direct task"
			/>
			<button type="submit" class={button.ghost} disabled={busy}>
				<Icon name="plus" size={15} /> Add
			</button>
		</form>
	</section>
{/if}
