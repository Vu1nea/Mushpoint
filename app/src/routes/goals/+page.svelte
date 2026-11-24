<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import DataTable from 'mushpoint-design/svelte/DataTable.svelte';
	import Pill from 'mushpoint-design/svelte/Pill.svelte';
	import RowMenu from 'mushpoint-design/svelte/RowMenu.svelte';
	import Segmented from 'mushpoint-design/svelte/Segmented.svelte';
	import Toolbar from 'mushpoint-design/svelte/Toolbar.svelte';
	import { deleteGoal, GOAL_STATUS_LABELS, TIMEFRAME_LABELS, type GoalSummary } from '$lib/api';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ErrorBanner from 'mushpoint-design/svelte/ErrorBanner.svelte';
	import GoalDrawer from '$lib/components/goals/GoalDrawer.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import PageHeader from '$lib/components/shell/PageHeader.svelte';
	import ProgressBar from 'mushpoint-design/svelte/ProgressBar.svelte';
	import { button, DUE_CLASSES, field } from '$lib/components/ui';
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
		{ key: 'category', label: 'Category', width: '11rem', hideBelow: 'md' as const },
		{ key: 'actions', label: '', width: '3.5rem', align: 'end' as const }
	];

	let drawerOpen = $state(false);
	let editingGoal = $state<GoalSummary | null>(null);
	let deletingGoal = $state<GoalSummary | null>(null);
	let busy = $state(false);
	let actionError = $state<unknown>(null);
	/** Client-side narrowing on top of the status filter the loader applies. */
	let query = $state('');
	let categoryFilter = $state('all');
	let timeframeFilter = $state('all');
	let filtersOpen = $state(false);

	const categoryById = $derived(
		new Map(data.categories.map((category) => [category.id, category]))
	);
	const categoryName = (goal: GoalSummary) =>
		(goal.categoryId ? categoryById.get(goal.categoryId)?.name : undefined) ?? 'Uncategorized';
	const colorOf = (goal: GoalSummary) =>
		categoryColor(goal.categoryId ? categoryById.get(goal.categoryId)?.colorToken : undefined);

	const filterCount = $derived(
		(categoryFilter === 'all' ? 0 : 1) + (timeframeFilter === 'all' ? 0 : 1)
	);

	/** Goals arrive pre-sorted; these only narrow them. */
	const visible = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return data.goals.filter((goal) => {
			if (categoryFilter !== 'all' && String(goal.categoryId ?? '') !== categoryFilter)
				return false;
			if (timeframeFilter !== 'all' && goal.timeframe !== timeframeFilter) return false;
			if (!needle) return true;
			return [goal.title, categoryName(goal), TIMEFRAME_LABELS[goal.timeframe]]
				.join(' ')
				.toLowerCase()
				.includes(needle);
		});
	});

	const categoryOptions = $derived([
		{ value: 'all', label: 'All', color: null },
		...data.categories.map((category) => ({
			value: String(category.id),
			label: category.name,
			color: categoryColor(category.colorToken)
		})),
		{ value: '', label: 'Uncategorized', color: null }
	]);
	const timeframeOptions = [
		{ value: 'all', label: 'Any' },
		...Object.entries(TIMEFRAME_LABELS).map(([value, label]) => ({ value, label }))
	];

	/** A category badge: its own color as a soft fill and a hairline ring, stronger when selected. */
	function badgeStyle(color: string | null, active = false) {
		if (!color) {
			return active
				? 'background:var(--color-surface);box-shadow:inset 0 0 0 1px var(--color-content)'
				: 'box-shadow:inset 0 0 0 1px var(--color-subtle)';
		}
		return `background:color-mix(in srgb, ${color} ${active ? 30 : 14}%, transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb, ${color} ${active ? 85 : 32}%, transparent)`;
	}

	let filterWrap = $state<HTMLElement>();
	let filterButton = $state<HTMLButtonElement>();

	function closeFilters(refocus = false) {
		filtersOpen = false;
		if (refocus) filterButton?.focus();
	}

	function clearFilters() {
		categoryFilter = 'all';
		timeframeFilter = 'all';
	}

	const empty = $derived(
		`No ${data.filter === 'all' ? '' : data.filter + ' '}goals here yet.${
			data.filter === 'active' ? ' Create one to start tracking progress.' : ''
		}`
	);

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

<svelte:window
	onmousedown={(event) => {
		if (filtersOpen && !filterWrap?.contains(event.target as Node)) closeFilters();
	}}
	onkeydown={(event) => {
		if (filtersOpen && event.key === 'Escape') closeFilters(true);
	}}
/>

<svelte:head><title>Goals · Mushpoint</title></svelte:head>

<PageHeader title="Goals">
	{#snippet actions()}
		<button type="button" class="{button.primary} shrink-0" onclick={newGoal}>
			<Icon name="plus" size={15} weight={2.4} />
			New Goal
		</button>
	{/snippet}
</PageHeader>

<div class="page-gutter pb-3">
	<Toolbar>
		<Segmented
			ariaLabel="Filter goals by status"
			options={[...FILTERS]}
			bind:value={
				() => data.filter,
				(value) => goto(`/goals?status=${value}`, { keepFocus: true, noScroll: true })
			}
		/>
		<div class="ml-auto flex min-w-0 items-center gap-2">
			<input
				type="search"
				class="{field.input} w-56 max-w-full min-w-32 shrink"
				placeholder="Search goals"
				aria-label="Search goals"
				bind:value={query}
			/>
			<div class="relative shrink-0" bind:this={filterWrap}>
				<button
					bind:this={filterButton}
					type="button"
					class="{button.ghost} border border-subtle"
					aria-expanded={filtersOpen}
					aria-controls="goal-filters"
					onclick={() => (filtersOpen = !filtersOpen)}
				>
					<Icon name="filter" size={14} weight={2.2} />
					Filter
					{#if filterCount > 0}
						<span
							class="rounded-full bg-accent px-1.5 text-2xs font-semibold text-accent-contrast tabular-nums"
						>
							{filterCount}
						</span>
					{/if}
				</button>

				{#if filtersOpen}
					<div
						id="goal-filters"
						role="group"
						aria-label="Goal filters"
						class="absolute top-full right-0 z-20 mt-2 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-4 rounded-card border border-subtle bg-surface-raised p-4 shadow-[0_16px_40px_rgba(0,0,0,0.3)]"
					>
						<div>
							<p class="mb-2 text-xs font-semibold text-muted">Category</p>
							<div class="flex flex-wrap gap-1.5">
								{#each categoryOptions as option (option.value)}
									<button
										type="button"
										class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-[background-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent {categoryFilter ===
										option.value
											? 'text-content'
											: 'text-muted hover:text-content'}"
										style={badgeStyle(option.color, categoryFilter === option.value)}
										aria-pressed={categoryFilter === option.value}
										onclick={() => (categoryFilter = option.value)}
									>
										{#if option.color}
											<span
												class="size-2 shrink-0 rounded-full"
												style:background={option.color}
												aria-hidden="true"
											></span>
										{/if}
										{option.label}
									</button>
								{/each}
							</div>
						</div>
						<div>
							<p class="mb-2 text-xs font-semibold text-muted">Timeframe</p>
							<div
								role="group"
								aria-label="Timeframe"
								class="flex divide-x divide-subtle overflow-hidden rounded-control border border-subtle"
							>
								{#each timeframeOptions as option (option.value)}
									<button
										type="button"
										class="flex-1 px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent {timeframeFilter ===
										option.value
											? 'bg-surface text-content'
											: 'text-muted hover:bg-surface hover:text-content'}"
										aria-pressed={timeframeFilter === option.value}
										onclick={() => (timeframeFilter = option.value)}
									>
										{option.label}
									</button>
								{/each}
							</div>
						</div>
						{#if filterCount > 0}
							<button type="button" class="{button.bare} self-start text-sm" onclick={clearFilters}>
								Clear filters
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</Toolbar>
</div>

{#if data.error}
	<div class="page-gutter pb-4"><ErrorBanner error={data.error} /></div>
{/if}
{#if actionError}
	<div class="page-gutter pb-4">
		<ErrorBanner error={actionError} onDismiss={() => (actionError = null)} />
	</div>
{/if}

{#snippet cellContent(goal: GoalSummary, key: string)}
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
				{#if goal.status !== 'active'}
					<Pill tone={statusTone(goal.status)}>{GOAL_STATUS_LABELS[goal.status]}</Pill>
				{/if}
			</p>
			<p class="truncate text-xs text-muted md:hidden">{categoryName(goal)}</p>
		</div>
	{:else if key === 'progress'}
		<span class="flex items-center gap-2">
			<span class="min-w-0 flex-1">
				<ProgressBar
					value={goal.progress}
					label="{goal.title} progress"
					height={5}
					color={colorOf(goal)}
					showValue={false}
				/>
			</span>
			<span class="w-9 shrink-0 text-right text-xs text-muted tabular-nums">
				{percent(goal.progress)}
			</span>
		</span>
	{:else if key === 'due'}
		<span class="text-xs {DUE_CLASSES[dueTone(goal.dueDate)]}"
			>{goal.dueDate ? dueLabel(goal.dueDate) : TIMEFRAME_LABELS[goal.timeframe]}</span
		>
	{:else if key === 'category'}
		<span
			class="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-content"
			style={badgeStyle(goal.categoryId ? colorOf(goal) : null)}
		>
			{#if goal.categoryId}
				<span
					class="size-1.5 shrink-0 rounded-full"
					style:background={colorOf(goal)}
					aria-hidden="true"
				></span>
			{/if}
			<span class="truncate">{categoryName(goal)}</span>
		</span>
	{:else}
		<RowMenu
			label="Actions for {goal.title}"
			items={[
				{ label: 'Edit', icon: 'edit', onSelect: () => edit(goal) },
				{ label: 'Delete', icon: 'trash', danger: true, onSelect: () => (deletingGoal = goal) }
			]}
		/>
	{/if}
{/snippet}

<div class="goal-rows page-gutter pb-6">
	{#if !data.error}
		<DataTable
			{columns}
			rows={visible}
			rowKey={(goal) => goal.id}
			{empty}
			ariaLabel="All goals"
			onRowClick={open}
		>
			{#snippet cell(goal, key)}
				{@render cellContent(goal, key)}
			{/snippet}
		</DataTable>
	{/if}
</div>

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
