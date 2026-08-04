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
		<div class="grid flex-1 grid-cols-2 grid-rows-2 gap-1.5 overflow-hidden rounded-control">
			{#each preview as item (item.id)}
				<VisionImage path={item.imagePath} alt="" class="h-full w-full object-cover" />
			{/each}
		</div>
	{/if}
</a>
