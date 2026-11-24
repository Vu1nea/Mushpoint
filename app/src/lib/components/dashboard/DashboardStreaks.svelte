<script lang="ts">
	import DashboardSectionTitle from './DashboardSectionTitle.svelte';
	import { RECURRENCE_LABELS, type StreakCard as StreakCardData } from '$lib/api';
	import { topStreaks } from '$lib/dashboard';
	import Icon from '../ui/Icon.svelte';
	import StreakHeatmap from '../streaks/StreakHeatmap.svelte';

	interface Props {
		streaks: StreakCardData[];
		class?: string;
	}

	let { streaks, class: className = '' }: Props = $props();

	const top = $derived(topStreaks(streaks));
</script>

<section class="dash-card {className}">
	<DashboardSectionTitle title="Streaks" tier="lead">
		{#snippet actions()}
			<a
				href="/tasks"
				class="text-xs font-semibold text-muted hover:text-content focus-visible:outline-2 focus-visible:outline-accent"
			>
				View all
			</a>
		{/snippet}
	</DashboardSectionTitle>

	{#if top.length === 0}
		<p class="dash-pad py-3 text-sm text-muted">No habits tracked yet.</p>
	{:else}
		<ul class="divide-y divide-subtle">
			{#each top as card (card.task.id)}
				<li class="flex flex-col gap-2 dash-pad py-2.5 text-sm">
					<div class="flex items-center gap-3">
						<span class="min-w-0 flex-1">
							<span class="block truncate">{card.task.title}</span>
							<span class="block text-xs text-muted">
								{card.task.recurrence ? RECURRENCE_LABELS[card.task.recurrence] : 'One-off'}
							</span>
						</span>
						<span class="flex shrink-0 flex-col items-end gap-0.5">
							<span class="flex items-center gap-1.5">
								<Icon name="flame" size={16} class="shrink-0 text-accent-ink" />
								<b class="text-base tabular-nums" aria-label="Current streak">{card.current}</b>
							</span>
							<span class="flex items-center gap-1.5 text-xs text-muted">
								<Icon
									name="crown"
									size={14}
									class="shrink-0 text-yellow-400 [[data-theme=coquette]_&]:text-yellow-600"
								/>
								<span class="tabular-nums" aria-label="Best streak">{card.longest}</span>
							</span>
						</span>
					</div>
					<StreakHeatmap cells={card.cells} active={card.current > 0} />
				</li>
			{/each}
		</ul>
	{/if}
</section>
