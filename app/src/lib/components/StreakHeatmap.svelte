<script lang="ts">
	import type { CellState, DayCell } from '$lib/api';
	import { cellTitle } from '$lib/format';
	import { stagger } from '$lib/motion';

	interface Props {
		cells: DayCell[];
	}

	let { cells }: Props = $props();

	/**
	 * Done reads as the accent; a closed miss is a faint outline rather than an
	 * alarm colour, because a broken streak is information, not an error.
	 */
	const CELL_CLASSES: Record<CellState, string> = {
		done: 'bg-accent-secondary',
		missed: 'bg-subtle/40',
		pending: 'bg-subtle/40 ring-1 ring-accent/40 ring-inset',
		not_expected: 'bg-subtle/15'
	};
</script>

<div
	class="grid w-full gap-0.75"
	style="grid-template-columns:repeat({cells.length}, minmax(0, 1fr))"
	role="img"
	aria-label="Completion history for the last {cells.length} days"
>
	{#each cells as cell, index (cell.date)}
		<span
			class="mp-enter aspect-square w-full rounded-xs {CELL_CLASSES[cell.state]}"
			style="--mp-delay:{stagger(index, 12)}"
			title={cellTitle(cell)}
		></span>
	{/each}
</div>
