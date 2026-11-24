<script lang="ts">
	import { backIn } from 'svelte/easing';
	import { scale } from 'svelte/transition';
	import type { CellState, DayCell } from '$lib/api';
	import { cellTitle, heatmapSummary } from '$lib/format';
	import { motion } from '$lib/motion';

	interface Props {
		/** Day cells ending today, oldest first. */
		cells: DayCell[];
		/** Whether the streak is alive. A broken streak keeps its history but drops the green. */
		active?: boolean;
	}

	let { cells, active = true }: Props = $props();

	/** Blank slots before the first day so rows line up as Sunday to Saturday. */
	const lead = $derived(cells.length ? new Date(`${cells[0].date}T00:00:00Z`).getUTCDay() : 0);
	const weeks = $derived(Math.ceil((lead + cells.length) / 7));

	/** The first week of each month gets its name above that column. */
	const monthLabels = $derived.by(() => {
		const labels: { week: number; name: string }[] = [];
		let last = '';
		cells.forEach((cell, index) => {
			const month = cell.date.slice(0, 7);
			const week = Math.floor((lead + index) / 7);
			if (month !== last && (labels.length === 0 || week > labels[labels.length - 1].week + 1)) {
				labels.push({
					week,
					name: new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, {
						month: 'short',
						timeZone: 'UTC'
					})
				});
			}
			last = month;
		});
		return labels;
	});

	const cellClasses = $derived<Record<CellState, string>>({
		done: active ? 'bg-accent-secondary/55' : 'bg-accent/55',
		missed: 'bg-subtle/40',
		pending: 'bg-subtle/40 ring-1 ring-accent/40 ring-inset',
		not_expected: 'bg-subtle/15'
	});
</script>

<div class="flex min-w-0 flex-col gap-1">
	<div
		class="grid text-2xs text-muted"
		style="grid-template-columns:repeat({weeks}, minmax(0, 1fr))"
		aria-hidden="true"
	>
		{#each monthLabels as label (label.week)}
			<span class="whitespace-nowrap" style="grid-column-start:{label.week + 1}">{label.name}</span>
		{/each}
	</div>
	<div
		class="grid grid-flow-col grid-rows-7 gap-0.5"
		style="grid-template-columns:repeat({weeks}, minmax(0, 1fr))"
		role="img"
		aria-label="Completion history for the last year. {heatmapSummary(cells)}"
	>
		{#each { length: lead } as _, index (index)}
			<span class="aspect-square" aria-hidden="true"></span>
		{/each}
		{#each cells as cell (cell.date)}
			<span
				class="aspect-square rounded-xs {cellClasses[cell.state]}"
				title={cellTitle(cell)}
				out:scale|local={{ duration: motion(160), start: 0, easing: backIn }}
			></span>
		{/each}
	</div>
</div>
