<script lang="ts">
	import SectionHeader from 'mushpoint-design/svelte/SectionHeader.svelte';
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

<section class="section-gutter {className}">
	<SectionHeader title="Streaks" count={streaks.length}>
		{#snippet actions()}
			{#if streaks.length > top.length}
				<a
					href="/tasks"
					class="text-xs font-semibold text-muted hover:text-content focus-visible:outline-2 focus-visible:outline-accent"
				>
					View all
				</a>
			{/if}
		{/snippet}
	</SectionHeader>

	{#if top.length === 0}
		<p class="page-gutter py-3 text-sm text-muted">No habits tracked yet.</p>
	{:else}
		<ul class="divide-y divide-subtle">
			{#each top as card (card.task.id)}
				<li class="flex flex-col gap-2 page-gutter py-2.5 text-sm">
					<div class="flex items-center gap-3">
						<Icon name="flame" size={14} class="shrink-0 text-accent-ink" />
						<span class="min-w-0 flex-1">
							<span class="block truncate">{card.task.title}</span>
							<span class="block text-xs text-muted">
								{card.task.recurrence ? RECURRENCE_LABELS[card.task.recurrence] : 'One-off'}
							</span>
						</span>
						<b class="tabular-nums">{card.current}</b>
						<span class="text-xs text-muted">best {card.longest}</span>
					</div>
					<StreakHeatmap cells={card.cells} />
				</li>
			{/each}
		</ul>
	{/if}
</section>
