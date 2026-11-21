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

	/** Sticky-note paper colors for quote-only items. Dark ink on all of them
	 * keeps contrast in both themes. */
	const NOTES = [
		'bg-yellow-200',
		'bg-pink-200',
		'bg-sky-200',
		'bg-lime-200',
		'bg-orange-200',
		'bg-violet-200'
	];
	/** Small fixed tilts in degrees; picked by id so a card keeps its look. */
	const TILTS = [-2.5, 1.5, -1, 2.5, -1.8, 1, -0.6, 2];

	const isNote = (item: VisionItemView) => !item.imageUrl && !!item.quoteText;
	const isPhoto = (item: VisionItemView) => !!item.imageUrl;
	const tilt = (item: VisionItemView) => TILTS[item.id % TILTS.length];
	const noteColor = (item: VisionItemView) => NOTES[(item.id * 7) % NOTES.length];

	/** Card chrome: sticky note, polaroid, or a plain card for anything else. */
	function paperClass(item: VisionItemView) {
		const over = dragOverId === item.id;
		const paper = 'text-neutral-900 [&_button]:text-neutral-800 ';
		if (isNote(item)) {
			return `${paper}rounded-xs px-4 pt-6 pb-3 shadow-[0_6px_14px_rgba(0,0,0,0.28)] hover:shadow-[0_10px_22px_rgba(0,0,0,0.35)] ${over ? 'bg-accent/40' : noteColor(item)}`;
		}
		if (isPhoto(item)) {
			return `${paper}rounded-xs px-2.5 pt-2.5 pb-2 shadow-[0_6px_14px_rgba(0,0,0,0.3)] hover:shadow-[0_10px_22px_rgba(0,0,0,0.38)] ${over ? 'bg-accent/40' : 'bg-stone-50'}`;
		}
		return `rounded-card border p-3 ${over ? 'border-accent bg-accent/5' : 'border-subtle bg-surface shadow-[0_4px_10px_rgba(0,0,0,0.18)]'}`;
	}

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
	<div class="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4 xl:columns-5" bind:this={board}>
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
				class="group relative mb-5 break-inside-avoid transition-[transform,box-shadow,background-color] duration-200 hover:z-10 hover:rotate-0! {paperClass(
					item
				)} {dragOverId === item.id ? '' : 'mp-enter'}"
				style="--mp-delay:{stagger(index, 30)}; rotate:{tilt(item)}deg"
				draggable={!busy}
				ondragstart={(event) => dragStart(event, item)}
				ondragover={(event) => dragOver(event, item)}
				ondragleave={() => dragLeave(item)}
				ondragend={() => (dragId = null)}
				ondrop={(event) => drop(event, item)}
			>
				{#if isNote(item) || isPhoto(item)}
					<span
						class="pointer-events-none absolute -top-2 left-1/2 z-10 h-4 w-14 -translate-x-1/2 shadow-sm {isPhoto(
							item
						)
							? '-rotate-3 bg-amber-200/70'
							: 'rotate-2 bg-white/50'}"
						aria-hidden="true"
					></span>
				{/if}
				<VisionImage
					src={item.imageUrl}
					class={isPhoto(item)
						? 'w-full rounded-[1px] object-cover'
						: 'mb-2 w-full rounded-control object-cover'}
				/>
				{#if item.quoteText}
					<p
						class={isNote(item)
							? 'font-display text-base leading-snug font-semibold wrap-break-word sm:text-lg'
							: isPhoto(item)
								? 'mt-2.5 line-clamp-3 px-0.5 font-display text-base leading-snug font-semibold wrap-break-word'
								: 'text-sm leading-relaxed text-content'}
					>
						{item.quoteText}
					</p>
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
