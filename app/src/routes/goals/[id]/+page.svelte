<script lang="ts">
	import { open } from '@tauri-apps/plugin-shell';
	import { goto, invalidateAll } from '$app/navigation';
	import {
		createSubgoal,
		createTask,
		deleteGoal,
		GOAL_STATUS_LABELS,
		GOAL_STATUSES,
		setGoalStatus,
		TIMEFRAME_LABELS,
		type GoalStatus
	} from '$lib/api';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import Checkbox from '$lib/components/Checkbox.svelte';
	import GoalDrawer from '$lib/components/GoalDrawer.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import SubgoalCard from '$lib/components/SubgoalCard.svelte';
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

	let newSubgoalTitle = $state('');
	let newSubgoalDue = $state('');
	let newTaskTitle = $state('');

	const accent = $derived(categoryColor(data.goal?.category?.colorToken));
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

	async function changeStatus(status: GoalStatus) {
		if (!data.goal || data.goal.status === status) return;
		await run(() => setGoalStatus(data.goal!.id, status));
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
		<div class="rounded-card border border-subtle bg-surface p-4.5 lg:sticky lg:top-0">
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
						<button type="button" class={button.icon} onclick={() => open(repoUrl)}>
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

			<h1 class="mt-3.5 mb-2 font-display text-2xl leading-tight font-bold">{goal.title}</h1>

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
				{percent(goal.progress)} complete · averaged across {goal.subgoals.length} subgoals and {goal
					.directTasks.length} direct tasks
			</p>

			<div class="mb-5 flex gap-1.5">
				{#each GOAL_STATUSES as status (status)}
					<button
						type="button"
						class={segment(goal.status === status)}
						aria-pressed={goal.status === status}
						disabled={busy}
						onclick={() => changeStatus(status)}
					>
						{GOAL_STATUS_LABELS[status]}
					</button>
				{/each}
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
					<input
						type="date"
						class="{field.dashed} w-37.5 shrink-0"
						bind:value={newSubgoalDue}
						aria-label="New subgoal due date"
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
		</div>
	</div>

	<GoalDrawer
		open={editing}
		categories={data.categories}
		{goal}
		onClose={() => (editing = false)}
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
{/if}
