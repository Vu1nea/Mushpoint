<script lang="ts">
	import type { CellState, DayCell } from '$lib/api';
	import { backIn } from 'svelte/easing';
	import { scale } from 'svelte/transition';
	import { cellTitle, heatmapSummary } from '$lib/format';
	import { motion, stagger } from '$lib/motion';

	interface Props {
		/** Day cells ending today; only the latest calendar month is drawn. */
		cells: DayCell[];
		/** Whether the streak is alive. A broken streak keeps its history but drops the green. */
		active?: boolean;
	}

	let { cells, active = true }: Props = $props();

	const month = $derived(cells.length ? cells[cells.length - 1].date.slice(0, 7) : '');
	const days = $derived(cells.filter((cell) => cell.date.startsWith(month)));

	/** Blank slots before the first day so rows line up as Sunday to Saturday. */
	const lead = $derived(days.length ? new Date(`${days[0].date}T00:00:00Z`).getUTCDay() : 0);

	const label = $derived(
		month
			? new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, {
					month: 'long',
					timeZone: 'UTC'
				})
			: ''
	);

	const cellClasses = $derived<Record<CellState, string>>({
		done: active ? 'bg-accent-secondary/50' : 'bg-accent/50',
		missed: 'bg-subtle/40',
		pending: 'bg-subtle/40 ring-1 ring-accent/40 ring-inset',
		not_expected: 'bg-subtle/15'
	});
</script>

<div class="flex flex-col gap-1">
	<span class="text-xs text-muted">{label}</span>
	<div
		class="grid grid-cols-7 gap-0.75"
		style="grid-template-columns:repeat(7, 0.75rem)"
		role="img"
		aria-label="{label} completion history. {heatmapSummary(days)}"
	>
		{#each { length: lead } as _, index (index)}
			<span class="size-3" aria-hidden="true"></span>
		{/each}
		{#each days as cell, index (cell.date)}
			<span
				class="streak-cell size-3 rounded-xs {cellClasses[cell.state]}"
				style="--pop-delay:{stagger(index, 15, 300)}"
				title={cellTitle(cell)}
				out:scale|local={{ duration: motion(160), start: 0, easing: backIn }}
			></span>
		{/each}
	</div>
</div>

<style>
	/* Pop in: overshoot past full size, then settle. Reduced motion is flattened
	   by the theme's reduced-motion block. */
	.streak-cell {
		animation: streak-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1) var(--pop-delay, 0ms) backwards;
	}

	@keyframes streak-pop {
		from {
			opacity: 0;
			transform: scale(0);
		}
	}
</style>
