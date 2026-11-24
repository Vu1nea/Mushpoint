<script lang="ts">
	import type { DashboardStats } from '$lib/dashboard';

	interface Props {
		stats: DashboardStats;
		class?: string;
	}

	let { stats, class: className = '' }: Props = $props();

	const items = $derived([
		{ label: 'Due today', value: stats.dueToday, warn: false },
		{ label: 'Overdue', value: stats.overdue, warn: stats.overdue > 0 },
		{ label: 'Active goals', value: stats.activeGoals, warn: false },
		{ label: 'Best streak', value: stats.bestStreak, warn: false }
	]);
</script>

<dl
	class="grid grid-cols-2 divide-subtle dash-card sm:grid-cols-4 sm:divide-x max-sm:[&>div:nth-child(even)]:border-l max-sm:[&>div:nth-child(even)]:border-subtle max-sm:[&>div:nth-child(n+3)]:border-t max-sm:[&>div:nth-child(n+3)]:border-subtle {className}"
>
	{#each items as item (item.label)}
		<div class="px-5 py-3">
			<dt class="text-xs font-medium text-muted">{item.label}</dt>
			<dd
				class="mt-0.5 font-display text-2xl font-semibold tabular-nums {item.warn
					? 'text-warn'
					: 'text-content'}"
			>
				{item.value}
			</dd>
		</div>
	{/each}
</dl>
