<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import DataTable from 'mushpoint-design/svelte/DataTable.svelte';
	import Pill from 'mushpoint-design/svelte/Pill.svelte';
	import RowMenu from 'mushpoint-design/svelte/RowMenu.svelte';
	import SectionHeader from 'mushpoint-design/svelte/SectionHeader.svelte';
	import Segmented from 'mushpoint-design/svelte/Segmented.svelte';
	import Toolbar from 'mushpoint-design/svelte/Toolbar.svelte';
	import { deleteGoal, GOAL_STATUS_LABELS, TIMEFRAME_LABELS, type GoalSummary } from '$lib/api';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ErrorBanner from 'mushpoint-design/svelte/ErrorBanner.svelte';
	import GoalDrawer from '$lib/components/goals/GoalDrawer.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import ProgressBar from 'mushpoint-design/svelte/ProgressBar.svelte';
	import Select from 'mushpoint-design/svelte/Select.svelte';
	import { button, DUE_CLASSES } from '$lib/components/ui';
	import { dueLabel, dueTone, percent } from '$lib/format';
	import { statusTone } from '$lib/statusTone';
	import { categoryColor } from '$lib/theme/category';

	let { data } = $props();

	const FILTERS = [
		{ value: 'active', label: 'Active' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'archived', label: 'Archived' },
		{ value: 'all', label: 'All' }
	] as const;

	const columns = [
		{ key: 'title', label: 'Goal' },
		{ key: 'progress', label: 'Progress', width: '11rem', hideBelow: 'md' as const },
		{ key: 'due', label: 'Due', width: '9rem', hideBelow: 'md' as const },
		{ key: 'status', label: 'Status', width: '7rem' },
		{ key: 'actions', label: '', width: '3rem', align: 'end' as const }
	];

	let drawerOpen = $state(false);
	let editingGoal = $state<GoalSummary | null>(null);
	let deletingGoal = $state<GoalSummary | null>(null);
	let busy = $state(false);
	let actionError = $state<unknown>(null);
	/** Client-side narrowing on top of the status filter the loader applies. */
	let categoryFilter = $state('all');

	const visible = $derived(
		categoryFilter === 'all'
			? data.goals
			: data.goals.filter((goal) => String(goal.categoryId ?? '') === categoryFilter)
	);

	const categoryName = $derived(
		new Map(data.categories.map((category) => [category.id, category.name]))
	);

	/** Goals arrive pre-sorted; grouping only splits them by category for display. */
	const grouped = $derived.by(() => {
		const byId = new Map(data.categories.map((category) => [category.id, category]));
		const groups = new Map<string, { color: string; goals: typeof visible }>();

		for (const goal of visible) {
			const category = goal.categoryId ? byId.get(goal.categoryId) : undefined;
			const name = category?.name ?? 'Uncategorized';
			const group = groups.get(name) ?? { color: categoryColor(category?.colorToken), goals: [] };
			groups.set(name, { ...group, goals: [...group.goals, goal] });
		}
		return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
	});

	const empty = $derived(
		`No ${data.filter === 'all' ? '' : data.filter + ' '}goals here yet.${
			data.filter === 'active' ? ' Create one to start tracking progress.' : ''
		}`
	);

	const subLine = (goal: GoalSummary) =>
		[
			(goal.categoryId ? categoryName.get(goal.categoryId) : undefined) ?? 'Uncategorized',
			TIMEFRAME_LABELS[goal.timeframe]
		].join(' · ');

	const counts = (goal: GoalSummary) =>
		`${goal.subgoalCount} ${goal.subgoalCount === 1 ? 'subgoal' : 'subgoals'} · ${goal.taskCount} direct ${
			goal.taskCount === 1 ? 'task' : 'tasks'
		}`;

	function newGoal() {
		editingGoal = null;
		drawerOpen = true;
	}

	function edit(goal: GoalSummary) {
		editingGoal = goal;
		drawerOpen = true;
	}

	async function removeGoal() {
		const goal = deletingGoal;
		if (!goal) return;
		busy = true;
		actionError = null;
		try {
			await deleteGoal(goal.id, false);
			await invalidateAll();
		} catch (error) {
			actionError = error;
		} finally {
			deletingGoal = null;
			busy = false;
		}
	}

	const open = (goal: GoalSummary) => goto(`/goals/${goal.id}`);
</script>

<svelte:head><title>Goals · Mushpoint</title></svelte:head>

<PageHeader title="Goals" subtitle="{visible.length} {visible.length === 1 ? 'goal' : 'goals'}">
	{#snippet actions()}
		<button type="button" class="{button.primary} shrink-0" onclick={newGoal}>
			<Icon name="plus" size={15} weight={2.4} />
			New Goal
		</button>
	{/snippet}
</PageHeader>

<div class="px-4 pb-3 md:px-8">
	<Toolbar>
		<Segmented
			ariaLabel="Filter goals by status"
			options={[...FILTERS]}
			bind:value={
				() => data.filter,
				(value) => goto(`/goals?status=${value}`, { keepFocus: true, noScroll: true })
			}
		/>
		<Select
			bind:value={categoryFilter}
			ariaLabel="Filter goals by category"
			class="w-55 max-w-full"
			options={[
				{ value: 'all', label: 'All categories' },
				...data.categories.map((category) => ({
					value: String(category.id),
					label: category.name
				})),
				{ value: '', label: 'Uncategorized' }
			]}
		/>
	</Toolbar>
</div>

{#if data.error}
	<div class="px-4 pb-4 md:px-8"><ErrorBanner error={data.error} /></div>
{/if}
{#if actionError}
	<div class="px-4 pb-4 md:px-8">
		<ErrorBanner error={actionError} onDismiss={() => (actionError = null)} />
	</div>
{/if}

{#snippet cellContent(goal: GoalSummary, key: string, color: string)}
	{#if key === 'title'}
		<div class="min-w-0">
			<p class="flex min-w-0 items-center gap-1.5">
				{#if goal.fromIdea}
					<Icon name="idea" size={12} label="Promoted from an idea" />
				{/if}
				<a
					href="/goals/{goal.id}"
					class="truncate focus-visible:outline-2 focus-visible:outline-accent"
					onclick={(event) => event.stopPropagation()}>{goal.title}</a
				>
			</p>
			<p class="truncate text-xs text-muted">{subLine(goal)}</p>
			<p class="truncate text-xs text-muted max-md:hidden">{counts(goal)}</p>
		</div>
	{:else if key === 'progress'}
		<span class="flex items-center gap-2">
			<span class="min-w-0 flex-1">
				<ProgressBar
					value={goal.progress}
					label="{goal.title} progress"
					height={5}
					{color}
					showValue={false}
				/>
			</span>
			<span class="w-9 shrink-0 text-right text-xs text-muted tabular-nums">
				{percent(goal.progress)}
			</span>
		</span>
	{:else if key === 'due'}
		<span class="text-xs {DUE_CLASSES[dueTone(goal.dueDate)]}">{dueLabel(goal.dueDate)}</span>
	{:else if key === 'status'}
		<Pill tone={statusTone(goal.status)}>{GOAL_STATUS_LABELS[goal.status]}</Pill>
	{:else}
		<RowMenu
			label="Actions for {goal.title}"
			items={[
				{ label: 'Edit', onSelect: () => edit(goal) },
				{ label: 'Delete', danger: true, onSelect: () => (deletingGoal = goal) }
			]}
		/>
	{/if}
{/snippet}

{#if visible.length === 0 && !data.error}
	<DataTable
		{columns}
		rows={[] as GoalSummary[]}
		rowKey={(goal) => goal.id}
		{empty}
		ariaLabel="Goals"
	>
		{#snippet cell()}{/snippet}
	</DataTable>
{:else if visible.length > 0}
	{#each grouped as [name, group] (name)}
		<section class="mb-6">
			<SectionHeader title={name} count={group.goals.length} />
			<DataTable
				{columns}
				rows={group.goals}
				rowKey={(goal) => goal.id}
				{empty}
				ariaLabel="{name} goals"
				onRowClick={open}
			>
				{#snippet cell(goal, key)}
					{@render cellContent(goal, key, group.color)}
				{/snippet}
			</DataTable>
		</section>
	{/each}
{/if}

<GoalDrawer
	open={drawerOpen}
	categories={data.categories}
	goal={editingGoal}
	onClose={() => (drawerOpen = false)}
	onSaved={invalidateAll}
/>

<ConfirmDialog
	open={deletingGoal !== null}
	title="Delete “{deletingGoal?.title ?? ''}”?"
	body="Its subgoals are removed. Tasks, including those in its subgoals, stay as standalone tasks. This cannot be undone."
	{busy}
	onConfirm={removeGoal}
	onCancel={() => (deletingGoal = null)}
/>
