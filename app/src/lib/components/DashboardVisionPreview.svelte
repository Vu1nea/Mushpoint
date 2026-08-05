<script lang="ts">
	import type { VisionItem } from '$lib/api';
	import Icon from './Icon.svelte';
	import VisionImage from './VisionImage.svelte';
	import { button, sectionHeading } from './ui';

	interface Props {
		items: VisionItem[];
		class?: string;
	}

	let { items, class: className = '' }: Props = $props();

	const preview = $derived(
		items.filter((item): item is VisionItem & { imagePath: string } => item.imagePath !== null).slice(0, 4)
	);

	/** Grid dims by item count so a partial preview (1-3 images) fills the
	 * available cells instead of leaving empty tracks. */
	const gridClass = $derived(
		preview.length >= 3
			? 'grid-cols-2 grid-rows-2'
			: preview.length === 2
				? 'grid-cols-2 grid-rows-1'
				: 'grid-cols-1 grid-rows-1'
	);
</script>

<a
	href="/vision-board"
	class="flex flex-col rounded-card border border-subtle bg-surface p-4.5 transition-colors hover:border-accent/60 {className}"
>
	<div class="mb-4 flex items-center justify-between gap-2">
		<h2 class={sectionHeading}>Vision board</h2>
		<Icon name="chevron-right" size={14} class="text-muted" />
	</div>

	{#if preview.length === 0}
		<div class="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
			<Icon name="vision" size={20} class="text-muted" />
			<p class="text-xs text-muted">No images yet — visit the board to add one.</p>
			<span class={button.ghost}>Open board</span>
		</div>
	{:else}
		<div class="grid aspect-[16/10] min-h-0 gap-1.5 overflow-hidden rounded-control {gridClass}">
			{#each preview as item (item.id)}
				<VisionImage path={item.imagePath} alt="" class="h-full min-h-0 w-full min-w-0 object-cover" />
			{/each}
		</div>
	{/if}
</a>
