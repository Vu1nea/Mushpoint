<script lang="ts">
	import type { StreakCard as StreakCardData } from '$lib/api';
	import { topStreaks } from '$lib/dashboard';
	import Icon from './Icon.svelte';
	import StreakCard from './StreakCard.svelte';
	import { sectionHeading } from './ui';

	interface Props {
		streaks: StreakCardData[];
		class?: string;
	}

	let { streaks, class: className = '' }: Props = $props();

	const top = $derived(topStreaks(streaks));
</script>

<section class="flex flex-col rounded-card border border-subtle bg-surface p-4.5 {className}">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class={sectionHeading}>Streaks</h2>
		{#if streaks.length > top.length}
			<a href="/tasks" class="flex items-center gap-0.5 text-xs font-semibold text-muted hover:text-content">
				View all
				<Icon name="chevron-right" size={12} />
			</a>
		{/if}
	</div>

	{#if top.length === 0}
		<p class="flex-1 py-8 text-center text-md text-muted">No habits tracked yet.</p>
	{:else}
		<div class="grid gap-3 sm:grid-cols-2">
			{#each top as card (card.task.id)}
				<StreakCard {card} />
			{/each}
		</div>
	{/if}
</section>
