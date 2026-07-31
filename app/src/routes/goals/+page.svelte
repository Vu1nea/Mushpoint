<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { createGoal, TIMEFRAME_LABELS, TIMEFRAMES, type Timeframe } from '$lib/api';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import { button, card, field } from '$lib/components/ui';
	import { dueLabel, isOverdue } from '$lib/format';

	let { data } = $props();

	const FILTERS = [
		{ value: 'active', label: 'Active' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'archived', label: 'Archived' },
		{ value: 'all', label: 'All' }
	];

	let showForm = $state(false);
	let saving = $state(false);
	let formError = $state<unknown>(null);

	let title = $state('');
	let timeframe = $state<Timeframe>('mid');
	let categoryId = $state<string>('');
	let dueDate = $state('');
	let description = $state('');
	let motivationText = $state('');

	/** Goals arrive pre-sorted; grouping only splits them by category for display. */
	const grouped = $derived.by(() => {
		const names = new Map(data.categories.map((category) => [category.id, category.name]));
		const groups = new Map<string, typeof data.goals>();

		for (const goal of data.goals) {
			const name = goal.categoryId
				? (names.get(goal.categoryId) ?? 'Uncategorized')
				: 'Uncategorized';
			groups.set(name, [...(groups.get(name) ?? []), goal]);
		}
		return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
	});

	function resetForm() {
		title = '';
		timeframe = 'mid';
		categoryId = '';
		dueDate = '';
		description = '';
		motivationText = '';
		formError = null;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		formError = null;

		try {
			await createGoal({
				categoryId: categoryId ? Number(categoryId) : null,
				title,
				description: description || null,
				timeframe,
				dueDate: dueDate || null,
				motivationText: motivationText || null,
				motivationImagePath: null
			});
			resetForm();
			showForm = false;
			await invalidateAll();
		} catch (error) {
			formError = error;
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Goals · Mushpoint</title></svelte:head>

<header class="mb-6 flex items-center justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold">Goals</h1>
		<p class="text-sm text-muted">
			{data.goals.length}
			{data.goals.length === 1 ? 'goal' : 'goals'} in view
		</p>
	</div>
	<button type="button" class={button.primary} onclick={() => (showForm = !showForm)}>
		<Icon name={showForm ? 'close' : 'plus'} size={16} />
		{showForm ? 'Cancel' : 'New goal'}
	</button>
</header>

<nav class="mb-6 flex flex-wrap gap-2" aria-label="Filter goals by status">
	{#each FILTERS as option (option.value)}
		<a
			href="/goals?status={option.value}"
			aria-current={data.filter === option.value ? 'page' : undefined}
			class="rounded-full border px-3 py-1 text-sm transition-colors
				{data.filter === option.value
				? 'border-accent bg-accent text-accent-contrast'
				: 'border-subtle text-muted hover:text-content'}"
		>
			{option.label}
		</a>
	{/each}
</nav>

{#if data.error}
	<div class="mb-6"><ErrorBanner error={data.error} /></div>
{/if}

{#if showForm}
	<form class="{card} mb-6 grid gap-4" onsubmit={submit}>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<label class={field.label} for="goal-title">Title</label>
				<input
					id="goal-title"
					class={field.input}
					bind:value={title}
					placeholder="Run a half marathon"
					required
				/>
			</div>

			<div>
				<label class={field.label} for="goal-timeframe">Timeframe</label>
				<select id="goal-timeframe" class={field.input} bind:value={timeframe}>
					{#each TIMEFRAMES as option (option)}
						<option value={option}>{TIMEFRAME_LABELS[option]}</option>
					{/each}
				</select>
			</div>

			<div>
				<label class={field.label} for="goal-category">Category</label>
				<select id="goal-category" class={field.input} bind:value={categoryId}>
					<option value="">Uncategorized</option>
					{#each data.categories as category (category.id)}
						<option value={String(category.id)}>{category.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label class={field.label} for="goal-due">Due date</label>
				<input id="goal-due" type="date" class={field.input} bind:value={dueDate} />
			</div>

			<div>
				<label class={field.label} for="goal-motivation">Motivation</label>
				<input
					id="goal-motivation"
					class={field.input}
					bind:value={motivationText}
					placeholder="Why this matters"
				/>
			</div>

			<div class="sm:col-span-2">
				<label class={field.label} for="goal-description">Description</label>
				<textarea id="goal-description" class={field.input} rows="2" bind:value={description}
				></textarea>
			</div>
		</div>

		{#if formError}
			<ErrorBanner error={formError} onDismiss={() => (formError = null)} />
		{/if}

		<div class="flex justify-end gap-2">
			<button type="button" class={button.ghost} onclick={resetForm}>Clear</button>
			<button type="submit" class={button.primary} disabled={saving}>
				{saving ? 'Saving…' : 'Create goal'}
			</button>
		</div>
	</form>
{/if}

{#if data.goals.length === 0 && !data.error}
	<EmptyState
		icon="goal"
		title="No goals here yet"
		hint={data.filter === 'active'
			? 'Create one to start tracking progress.'
			: 'Try a different status filter.'}
	/>
{:else}
	<div class="grid gap-6">
		{#each grouped as [categoryName, goals] (categoryName)}
			<section>
				<h2 class="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{categoryName}</h2>
				<ul class="grid gap-2">
					{#each goals as goal (goal.id)}
						<li>
							<a
								href="/goals/{goal.id}"
								class="{card} flex items-center gap-4 transition-colors hover:border-accent"
							>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class="truncate font-medium">{goal.title}</span>
										<span class="rounded-full border border-subtle px-2 py-0.5 text-xs text-muted">
											{TIMEFRAME_LABELS[goal.timeframe]}
										</span>
									</div>
									<p class="mt-1 text-xs {isOverdue(goal.dueDate) ? 'text-danger' : 'text-muted'}">
										{dueLabel(goal.dueDate)} · {goal.subgoalCount} subgoals · {goal.taskCount} direct
										tasks
									</p>
								</div>
								<div class="w-40 shrink-0">
									<ProgressBar value={goal.progress} label="{goal.title} progress" />
								</div>
								<Icon name="chevron-right" size={16} class="text-muted" />
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
{/if}
