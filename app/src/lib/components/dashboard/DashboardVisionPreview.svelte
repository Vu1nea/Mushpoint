<script lang="ts">
	import type { VisionItemView } from '$lib/api';
	import Icon from '../ui/Icon.svelte';
	import { boardSurface, noteColorOf, tiltOf } from '../vision/paper';
	import VisionImage from '../vision/VisionImage.svelte';
	import { button, sectionHeading } from '../ui';

	interface Props {
		items: VisionItemView[];
		class?: string;
	}

	let { items, class: className = '' }: Props = $props();

	/** A taste of the board: the first few photos and quotes, as pinned paper. */
	const preview = $derived(items.filter((item) => item.imageUrl || item.quoteText).slice(0, 4));

	const paper =
		'relative min-h-0 min-w-0 overflow-hidden rounded-xs text-neutral-900 shadow-[0_6px_14px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]';
</script>

<a
	href="/vision-board"
	class="flex flex-col {boardSurface} p-4.5 transition-colors hover:border-accent/60 {className}"
>
	<div class="mb-4 flex items-center justify-between gap-2">
		<h2 class={sectionHeading}>Vision board</h2>
		<Icon name="chevron-right" size={14} class="text-muted" />
	</div>

	{#if preview.length === 0}
		<div class="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
			<Icon name="vision" size={20} class="text-muted" />
			<p class="text-xs text-muted">Nothing pinned yet — visit the board to add something.</p>
			<span class={button.ghost}>Open board</span>
		</div>
	{:else}
		<div
			class="grid min-h-0 flex-1 gap-3 p-1 {preview.length > 2
				? 'grid-cols-2 grid-rows-2'
				: preview.length === 2
					? 'grid-cols-2 grid-rows-1'
					: 'grid-cols-1 grid-rows-1'}"
		>
			{#each preview as item (item.id)}
				<div
					class="{paper} {item.imageUrl
						? 'bg-stone-50 p-1.5'
						: 'flex items-center px-3 py-2 ' + noteColorOf(item.id)}"
					style="rotate:{tiltOf(item.id)}deg"
				>
					{#if item.imageUrl}
						<VisionImage
							src={item.imageUrl}
							alt=""
							class="size-full rounded-[1px] object-cover object-center"
						/>
					{:else}
						<p class="line-clamp-4 font-display text-xs leading-snug font-semibold">
							{item.quoteText}
						</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</a>
