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

	const isPhoto = (item: VisionItemView) => !!item.imageUrl;

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

	/** Sticky-note tints and tilts, cycled by position so neighbours differ. */
	const NOTES = [
		{ fill: 'bg-accent/15', tape: 'bg-accent/40' },
		{ fill: 'bg-accent-secondary/15', tape: 'bg-accent-secondary/40' },
		{ fill: 'bg-accent-tertiary/15', tape: 'bg-accent-tertiary/40' }
	];
	const TILTS = [-1.5, 1, -0.5, 1.5];
</script>

{#if items.length === 0}
	<div class="border-y border-subtle">
		<div class="flex flex-col items-center gap-3 page-gutter py-16">
			<p class="text-sm text-muted">
				No vision items yet — add an image or a quote to get started.
			</p>
			<button type="button" class={button.primary} onclick={onAddNew}>
				<Icon name="plus" size={15} weight={2.4} />
				Add your first item
			</button>
		</div>
	</div>
{:else}
	<p class="sr-only" aria-live="polite">{announcement}</p>
	<div
		class="columns-2 gap-4 page-gutter pb-8 sm:columns-3 lg:columns-4 xl:columns-5"
		bind:this={board}
	>
		{#each items as item, index (item.id)}
			<article
				aria-label="Vision item {index + 1} of {items.length}"
				class="group mb-6 break-inside-avoid rounded-control {dragOverId === item.id
					? 'ring-2 ring-accent'
					: 'mp-enter'}"
				style="--mp-delay:{stagger(index, 30)}"
				draggable={!busy}
				ondragstart={(event) => dragStart(event, item)}
				ondragover={(event) => dragOver(event, item)}
				ondragleave={() => dragLeave(item)}
				ondragend={() => (dragId = null)}
				ondrop={(event) => drop(event, item)}
			>
				{#if isPhoto(item)}
					<div class="relative overflow-hidden rounded-control">
						<VisionImage
							src={item.imageUrl}
							alt={item.quoteText ? '' : 'Vision board image'}
							class="w-full object-cover"
						/>
						{#if item.quoteText}
							<!-- Solid 75% black panel: white text stays above 8:1 over any image.
							     Always in the DOM so screen readers get it; shown on hover and focus. -->
							<p
								class="absolute inset-x-0 bottom-0 line-clamp-3 bg-black/75 px-3 py-2 text-sm leading-snug wrap-break-word text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
							>
								{item.quoteText}
							</p>
						{/if}
					</div>
				{:else if item.quoteText}
					{@const note = NOTES[index % NOTES.length]}
					<!-- A sticky note: tinted from the theme, a strip of tape, and a slight tilt that
					     varies down the board so the notes don't line up like cards. The tape sticks
					     out above the note, so the wrapper pads it with `pt-4` (padding, not a margin:
					     the board is CSS columns, which drop margins at a column's top edge and clip or
					     misplace anything overflowing it, leaving stray tape). -->
					<div class="pt-4">
						<div
							class="relative flex min-h-32 rotate-(--tilt) items-center rounded-control px-5 pt-7 pb-6 shadow-[0_10px_24px_-12px_rgb(0_0_0/0.6)] transition-[rotate] duration-(--mp-duration-base) ease-(--mp-ease-out) group-hover:rotate-0 motion-reduce:transition-none {note.fill}"
							style:--tilt="{TILTS[index % TILTS.length]}deg"
						>
							<span
								class="pointer-events-none absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 rounded-[3px] {note.tape}"
								aria-hidden="true"
							></span>
							<p
								class="font-display text-base leading-snug font-medium wrap-break-word whitespace-pre-line text-content sm:text-lg"
							>
								{item.quoteText}
							</p>
						</div>
					</div>
				{/if}

				<div
					class="mt-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100"
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
