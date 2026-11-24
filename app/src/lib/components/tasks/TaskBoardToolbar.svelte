<script lang="ts">
	import Select from 'mushpoint-design/svelte/Select.svelte';
	import type { GoalSummary } from '$lib/api';
	import { NO_FILTER, type DueFilter } from '$lib/kanban';
	import { button, field } from '../ui';

	interface Props {
		goals?: GoalSummary[];
		query: string;
		due: DueFilter;
		goalFilter: string;
	}

	let {
		goals = [],
		query = $bindable(),
		due = $bindable(),
		goalFilter = $bindable()
	}: Props = $props();

	const DUE_OPTIONS = [
		{ value: 'all', label: 'Any due date' },
		{ value: 'overdue', label: 'Overdue' },
		{ value: 'soon', label: 'Due soon' },
		{ value: 'later', label: 'Due later' },
		{ value: 'none', label: 'No due date' }
	];

	const filtering = $derived(query.trim() !== '' || due !== 'all' || goalFilter !== '');
	const goalOptions = $derived([
		{ value: '', label: 'All goals' },
		...goals.map((goal) => ({ value: String(goal.id), label: goal.title }))
	]);

	function clearFilters() {
		query = NO_FILTER.query;
		due = NO_FILTER.due;
		goalFilter = '';
	}
</script>

<div class="flex flex-wrap items-center gap-2">
	<input
		class="{field.input} max-w-60 flex-1"
		type="search"
		bind:value={query}
		placeholder="Search tasks…"
		aria-label="Search tasks"
	/>
	<Select
		class="w-40"
		ariaLabel="Filter by due date"
		bind:value={() => due, (value) => (due = value as DueFilter)}
		options={DUE_OPTIONS}
	/>
	{#if goals.length > 0}
		<Select
			class="w-48"
			ariaLabel="Filter by goal"
			bind:value={() => goalFilter, (value) => (goalFilter = value)}
			options={goalOptions}
		/>
	{/if}
	{#if filtering}
		<button type="button" class={button.bare} onclick={clearFilters}>Clear</button>
	{/if}
</div>
