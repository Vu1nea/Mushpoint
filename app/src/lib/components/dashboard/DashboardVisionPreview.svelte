<script lang="ts">
	import DashboardSectionTitle from './DashboardSectionTitle.svelte';
	import type { VisionItemView } from '$lib/api';
	import VisionImage from '../vision/VisionImage.svelte';

	interface Props {
		items: VisionItemView[];
		class?: string;
	}

	let { items, class: className = '' }: Props = $props();

	/** A taste of the board: the first few photos and quotes. */
	const preview = $derived(items.filter((item) => item.imageUrl || item.quoteText).slice(0, 4));
</script>

<section class="dash-card {className}">
	<DashboardSectionTitle title="Vision board">
		{#snippet actions()}
			<a
				href="/vision-board"
				class="text-xs font-semibold text-muted hover:text-content focus-visible:outline-2 focus-visible:outline-accent"
			>
				Open board
			</a>
		{/snippet}
	</DashboardSectionTitle>

	{#if preview.length === 0}
		<p class="dash-pad py-3 text-sm text-muted">
			Nothing pinned yet. Visit the board to add something.
		</p>
	{:else}
		<a
			href="/vision-board"
			aria-label="Open the vision board"
			class="grid grid-cols-2 gap-2 dash-pad pt-1 pb-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
		>
			{#each preview as item (item.id)}
				<div class="aspect-[4/3] min-w-0 overflow-hidden rounded-control bg-background">
					{#if item.imageUrl}
						<VisionImage src={item.imageUrl} alt="" class="size-full object-cover object-center" />
					{:else}
						<p
							class="line-clamp-5 p-3 font-display text-sm leading-snug font-semibold text-content"
						>
							{item.quoteText}
						</p>
					{/if}
				</div>
			{/each}
		</a>
	{/if}
</section>
