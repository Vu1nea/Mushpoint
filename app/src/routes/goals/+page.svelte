<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { GOAL_STATUS_LABELS, TIMEFRAME_LABELS, type GoalStatus } from '$lib/api';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import GoalDrawer from '$lib/components/GoalDrawer.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ProgressRing from '$lib/components/ProgressRing.svelte';
	import Select from '$lib/components/Select.svelte';
	import { button, chip, lift, sectionHeading } from '$lib/components/ui';
	import { dueLabel, dueTone } from '$lib/format';
	import { stagger } from '$lib/motion';
	import { categoryColor } from '$lib/theme/category';

	let { data } = $props();

	const FILTERS = [
		{ value: 'active', label: 'Active' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'archived', label: 'Archived' },
		{ value: 'all', label: 'All' }
	];

	const DUE_CLASSES = {
		none: 'text-muted',
		later: 'text-muted',
		soon: 'font-semibold text-accent-tertiary',
		overdue: 'font-bold text-warn'
	};

	/** Status feedback on the card itself — the "All" filter mixes every status together. */
	const STATUS_CLASSES: Record<GoalStatus, string> = {
		active: 'bg-accent-secondary/15 text-accent-secondary',
		completed: 'bg-accent/15 text-accent',
		archived: 'bg-background text-muted'
	};

	let drawerOpen = $state(false);
	/** Client-side narrowing on top of the status filter the loader applies. */
	let categoryFilter = $state('all');

	const visible = $derived(
		categoryFilter === 'all'
			? data.goals
			: data.goals.filter((goal) => String(goal.categoryId ?? '') === categoryFilter)
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
</script>

<svelte:head><title>Goals · Mushpoint</title></svelte:head>

<header class="mb-6 flex items-start justify-between gap-4">
	<div>
		<h1 class="mb-1 font-display text-3xl font-bold">Goals</h1>
		<p class="text-sm text-muted">
			{visible.length}
			{visible.length === 1 ? 'goal' : 'goals'} across {data.categories.length} categories
		</p>
	</div>
	<button type="button" class={button.primary} onclick={() => (drawerOpen = true)}>
		<Icon name="plus" size={15} weight={2.4} />
		New Goal
	</button>
</header>

<nav class="mb-3 flex flex-wrap gap-2" aria-label="Filter goals by status">
	{#each FILTERS as option (option.value)}
		<a
			href="/goals?status={option.value}"
			aria-current={data.filter === option.value ? 'page' : undefined}
			class={chip(data.filter === option.value)}
		>
			{option.label}
		</a>
	{/each}
</nav>

<Select bind:value={categoryFilter} ariaLabel="Filter goals by category" class="mb-7 max-w-55">
	<option value="all">All categories</option>
	{#each data.categories as category (category.id)}
		<option value={String(category.id)}>{category.name}</option>
	{/each}
	<option value="">Uncategorized</option>
</Select>

{#if data.error}
	<div class="mb-6"><ErrorBanner error={data.error} /></div>
{/if}

{#if visible.length === 0 && !data.error}
	<p class="px-5 py-12 text-center text-md text-muted">
		No {data.filter === 'all' ? '' : data.filter} goals here yet.
		{data.filter === 'active' ? 'Create one to start tracking progress.' : ''}
	</p>
{:else}
	{#each grouped as [categoryName, group] (categoryName)}
		<section class="mb-8">
			<div class="mb-3 flex items-center gap-2.5">
				<span class="size-2.5 rounded-full" style="background:{group.color}" aria-hidden="true"
				></span>
				<h2 class={sectionHeading}>{categoryName}</h2>
				<span class="text-xs text-muted/60">{group.goals.length}</span>
			</div>

			<ul class="flex flex-col gap-2.5">
				{#each group.goals as goal, index (goal.id)}
					<li class="mp-enter" style="--mp-delay:{stagger(index)}">
						<a
							href="/goals/{goal.id}"
							class="flex items-center gap-4 rounded-card border border-subtle bg-surface px-4.5 py-4 {lift}"
						>
							<ProgressRing
								value={goal.progress}
								label="{goal.title} progress"
								color={group.color}
							/>
							<div class="min-w-0 flex-1">
								<p class="truncate text-base font-semibold">{goal.title}</p>
								<p class="mt-1 text-xs text-muted">
									{goal.subgoalCount}
									{goal.subgoalCount === 1 ? 'subgoal' : 'subgoals'} · {goal.taskCount} direct
									{goal.taskCount === 1 ? 'task' : 'tasks'}
								</p>
							</div>
							{#if goal.status !== 'active'}
								<span
									class="shrink-0 rounded-full px-2.5 py-1 text-2xs font-bold tracking-wider uppercase {STATUS_CLASSES[
										goal.status
									]}"
								>
									{GOAL_STATUS_LABELS[goal.status]}
								</span>
							{/if}
							<span
								class="shrink-0 rounded-full bg-background px-2.5 py-1 text-2xs font-bold tracking-wider text-muted uppercase"
							>
								{TIMEFRAME_LABELS[goal.timeframe]}
							</span>
							<span
								class="min-w-21.5 shrink-0 text-right text-xs {DUE_CLASSES[
									dueTone(goal.dueDate)
								]}"
							>
								{dueLabel(goal.dueDate)}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
{/if}

<GoalDrawer
	open={drawerOpen}
	categories={data.categories}
	onClose={() => (drawerOpen = false)}
	onSaved={invalidateAll}
/>
