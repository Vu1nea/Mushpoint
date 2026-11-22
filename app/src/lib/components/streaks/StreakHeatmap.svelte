<script lang="ts">
	import type { CellState, DayCell } from '$lib/api';
	import { cellTitle, heatmapSummary } from '$lib/format';
	import { stagger } from '$lib/motion';

	interface Props {
		cells: DayCell[];
		/** Whether the streak is alive. A broken streak keeps its history but drops the green. */
		active?: boolean;
	}

	let { cells, active = true }: Props = $props();

	/**
	 * Done reads green while the streak is alive and the theme accent once it has
	 * broken, so past completions stay visible without implying a run in progress.
	 * A closed miss is a faint outline rather than an alarm colour, because a
	 * broken streak is information, not an error.
	 */
	const cellClasses = $derived<Record<CellState, string>>({
		done: active ? 'bg-accent-secondary' : 'bg-accent',
		missed: 'bg-subtle/40',
		pending: 'bg-subtle/40 ring-1 ring-accent/40 ring-inset',
		not_expected: 'bg-subtle/15'
	});
</script>

<div
	class="grid w-full gap-0.75"
	style="grid-template-columns:repeat({cells.length}, minmax(0, 1fr))"
	role="img"
	aria-label="Completion history. {heatmapSummary(cells)}"
>
	{#each cells as cell, index (cell.date)}
		<span
			class="mp-enter aspect-square w-full rounded-xs {cellClasses[cell.state]}"
			style="--mp-delay:{stagger(index, 12)}"
			title={cellTitle(cell)}
		></span>
	{/each}
</div>
