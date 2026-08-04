<!-- app/src/lib/components/VisionBoard.svelte -->
<script lang="ts">
	import type { VisionItem } from '$lib/api';
	import { stagger } from '$lib/motion';
	import Icon from './Icon.svelte';
	import VisionImage from './VisionImage.svelte';
	import { button } from './ui';

	interface Props {
		items: VisionItem[];
		busy: boolean;
		onReorder: (orderedIds: number[]) => Promise<void> | void;
		onEdit: (item: VisionItem) => void;
		onDelete: (item: VisionItem) => void;
		onAddNew: () => void;
	}

	let { items, busy, onReorder, onEdit, onDelete, onAddNew }: Props = $props();

	let dragId = $state<number | null>(null);
	let dragOverId = $state<number | null>(null);

	function dragStart(event: DragEvent, item: VisionItem) {
		dragId = item.id;
		event.dataTransfer?.setData('text/plain', String(item.id));
	}

	function dragOver(event: DragEvent, item: VisionItem) {
		event.preventDefault();
		if (item.id !== dragId) dragOverId = item.id;
	}

	function dragLeave(item: VisionItem) {
		if (dragOverId === item.id) dragOverId = null;
	}

	function drop(event: DragEvent, target: VisionItem) {
		event.preventDefault();
		dragOverId = null;
		const sourceId = Number(event.dataTransfer?.getData('text/plain'));
		dragId = null;
		if (busy || !sourceId || sourceId === target.id) return;

		const from = items.findIndex((i) => i.id === sourceId);
		const to = items.findIndex((i) => i.id === target.id);
		if (from < 0 || to < 0) return;

		const reordered = [...items];
		reordered.splice(to, 0, ...reordered.splice(from, 1));
		onReorder(reordered.map((i) => i.id));
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
	<div class="columns-1 gap-4 sm:columns-2 lg:columns-3">
		<button
			type="button"
			class="mb-4 flex h-32 w-full break-inside-avoid items-center justify-center rounded-card border border-dashed border-subtle text-muted transition-colors hover:border-accent/60 hover:text-content"
			onclick={onAddNew}
		>
			<Icon name="plus" size={20} weight={2} label="Add to Vision Board" />
		</button>

		{#each items as item, index (item.id)}
			<div
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
				{#if item.imagePath}
					<VisionImage path={item.imagePath} class="mb-2 w-full rounded-control object-cover" />
				{/if}
				{#if item.quoteText}
					<p class="text-sm leading-relaxed text-content">{item.quoteText}</p>
				{/if}

				<div
					class="mt-2 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
				>
					<button type="button" class={button.bare} onclick={() => onEdit(item)}>
						<Icon name="edit" size={13} label="Edit vision item" />
					</button>
					<button type="button" class={button.bare} disabled={busy} onclick={() => onDelete(item)}>
						<Icon name="trash" size={13} label="Delete vision item" />
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}
