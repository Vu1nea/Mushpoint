<script lang="ts">
	import DataTable from 'mushpoint-design/svelte/DataTable.svelte';
	import Pill from 'mushpoint-design/svelte/Pill.svelte';
	import SectionHeader from 'mushpoint-design/svelte/SectionHeader.svelte';
	import { goto } from '$app/navigation';
	import type { Category, GoalSummary } from '$lib/api';
	import { dueLabel, percent } from '$lib/format';
	import { statusTone } from '$lib/statusTone';
	import { categoryColor } from '$lib/theme/category';
	import Icon from '../ui/Icon.svelte';
	import ProgressBar from '../ui/ProgressBar.svelte';

	interface Props {
		goals: GoalSummary[];
		categories: Category[];
		class?: string;
	}

	let { goals, categories, class: className = '' }: Props = $props();

	const colorOf = $derived.by(() => {
		const byId = new Map(categories.map((category) => [category.id, category]));
		return (goal: GoalSummary) =>
			categoryColor(goal.categoryId ? byId.get(goal.categoryId)?.colorToken : undefined);
	});

	const columns = [
		{ key: 'title', label: 'Goal' },
		{ key: 'progress', label: 'Progress', width: '9rem' },
		{ key: 'due', label: 'Due', width: '9rem', hideBelow: 'md' as const },
		{ key: 'status', label: 'Status', width: '6.5rem', hideBelow: 'md' as const }
	];
</script>

<section class={className}>
	<SectionHeader title="Goals" count={goals.length}>
		{#snippet actions()}
			<a
				href="/goals"
				class="text-xs font-semibold text-muted hover:text-content focus-visible:outline-2 focus-visible:outline-accent"
			>
				View all
			</a>
		{/snippet}
	</SectionHeader>

	<DataTable
		{columns}
		rows={goals}
		rowKey={(goal) => goal.id}
		empty="No active goals yet."
		ariaLabel="Active goals"
		onRowClick={(goal) => goto(`/goals/${goal.id}`)}
	>
		{#snippet cell(goal, key)}
			{#if key === 'title'}
				<span class="flex items-center gap-1.5">
					{#if goal.fromIdea}
						<Icon name="idea" size={12} label="Promoted from an idea" />
					{/if}
					<span class="truncate">{goal.title}</span>
				</span>
			{:else if key === 'progress'}
				<span class="flex items-center gap-2">
					<span class="min-w-0 flex-1">
						<ProgressBar value={goal.progress} height={5} color={colorOf(goal)} showValue={false} />
					</span>
					<span class="w-9 shrink-0 text-right text-xs text-muted tabular-nums">
						{percent(goal.progress)}
					</span>
				</span>
			{:else if key === 'due'}
				<span class="text-xs text-muted">{dueLabel(goal.dueDate)}</span>
			{:else}
				<Pill tone={statusTone(goal.status)}>Active</Pill>
			{/if}
		{/snippet}
	</DataTable>
</section>
