<!-- app/src/lib/components/vision/VisionBoard.svelte -->
<script lang="ts">
	import { tick } from 'svelte';
	import type { VisionItemView } from '$lib/api';
	import { stagger } from '$lib/motion';
	import { moveId, moveIdBy } from '$lib/reorder';
	import Icon from '../ui/Icon.svelte';
	import VisionImage from './VisionImage.svelte';
	import { button } from '../ui';

	interface Props {
		items: VisionItemView[];
		busy: boolean;
		onReorder: (orderedIds: number[]) => Promise<void> | void;
		onEdit: (item: VisionItemView) => void;
		onDelete: (item: VisionItemView) => void;
		onAddNew: () => void;
	}

	let { items, busy, onReorder, onEdit, onDelete, onAddNew }: Props = $props();

	let dragId = $state<number | null>(null);
	let dragOverId = $state<number | null>(null);

	function dragStart(event: DragEvent, item: VisionItemView) {
		dragId = item.id;
		event.dataTransfer?.setData('text/plain', String(item.id));
	}

	function dragOver(event: DragEvent, item: VisionItemView) {
		event.preventDefault();
		if (item.id !== dragId) dragOverId = item.id;
	}

	function dragLeave(item: VisionItemView) {
		if (dragOverId === item.id) dragOverId = null;
	}

	function drop(event: DragEvent, target: VisionItemView) {
		event.preventDefault();
		dragOverId = null;
		const sourceId = Number(event.dataTransfer?.getData('text/plain'));
		dragId = null;
		if (busy || !sourceId) return;
		const next = moveId(
			items.map((i) => i.id),
			sourceId,
			target.id
		);
		if (next) onReorder(next);
	}

	/** Polite status line for screen readers after a keyboard move. */
	let announcement = $state('');
	let board = $state<HTMLElement>();

	/** Keyboard alternative to dragging (WCAG 2.5.7). The card moves in the DOM,
	 * which drops focus, so it is put back on the same button, or on the other
	 * one once the card reaches an end. */
	async function step(item: VisionItemView, direction: -1 | 1) {
		if (busy) return;
		const next = moveIdBy(
			items.map((i) => i.id),
			item.id,
			direction
		);
		if (!next) return;
		onReorder(next);
		announcement = `Moved to position ${next.indexOf(item.id) + 1} of ${next.length}`;
		await tick();
		const buttons = board?.querySelectorAll<HTMLButtonElement>(`[data-move-id="${item.id}"]`);
		const same = [...(buttons ?? [])].find((b) => b.dataset.direction === String(direction));
		(same ?? buttons?.[0])?.focus();
	}
</script>

{#if items.length === 0}
	<div
		class="flex flex-col items-center gap-3 rounded-card border border-dashed border-subtle py-16"
	>
		<p class="text-sm text-muted">No vision items yet — add an image or a quote to get started.</p>
		<button type="button" class={button.primary} onclick={onAddNew}>
			<Icon name="plus" size={15} weight={2.4} />
			Add to Vision Board
		</button>
	</div>
{:else}
	<p class="sr-only" aria-live="polite">{announcement}</p>
	<div class="columns-1 gap-4 sm:columns-2 lg:columns-3" bind:this={board}>
		<button
			type="button"
			class="mb-4 flex h-32 w-full break-inside-avoid items-center justify-center rounded-card border border-dashed border-subtle text-muted transition-colors hover:border-accent/60 hover:text-content"
			onclick={onAddNew}
		>
			<Icon name="plus" size={20} weight={2} label="Add to Vision Board" />
		</button>

		{#each items as item, index (item.id)}
			<article
				aria-label="Vision item {index + 1} of {items.length}"
				class="group mb-4 break-inside-avoid rounded-card border p-3 transition-colors {dragOverId ===
				item.id
					? 'border-accent bg-accent/5'
					: 'mp-enter border-subtle bg-surface'}"
				style="--mp-delay:{stagger(index, 30)}"
				draggable={!busy}
				ondragstart={(event) => dragStart(event, item)}
				ondragover={(event) => dragOver(event, item)}
				ondragleave={() => dragLeave(item)}
				ondragend={() => (dragId = null)}
				ondrop={(event) => drop(event, item)}
			>
				<VisionImage src={item.imageUrl} class="mb-2 w-full rounded-control object-cover" />
				{#if item.quoteText}
					<p class="text-sm leading-relaxed text-content">{item.quoteText}</p>
				{/if}

				<div
					class="mt-2 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100"
				>
					{#if index > 0}
						<button
							type="button"
							class="{button.bare} mp-hit"
							data-move-id={item.id}
							data-direction="-1"
							onclick={() => step(item, -1)}
						>
							<Icon name="chevron-right" size={13} class="rotate-180" label="Move earlier" />
						</button>
					{/if}
					{#if index < items.length - 1}
						<button
							type="button"
							class="{button.bare} mp-hit"
							data-move-id={item.id}
							data-direction="1"
							onclick={() => step(item, 1)}
						>
							<Icon name="chevron-right" size={13} label="Move later" />
						</button>
					{/if}
					<button type="button" class="{button.bare} mp-hit" onclick={() => onEdit(item)}>
						<Icon name="edit" size={13} label="Edit vision item" />
					</button>
					<button
						type="button"
						class="{button.bare} mp-hit"
						disabled={busy}
						onclick={() => onDelete(item)}
					>
						<Icon name="trash" size={13} label="Delete vision item" />
					</button>
				</div>
			</article>
		{/each}
	</div>
{/if}
