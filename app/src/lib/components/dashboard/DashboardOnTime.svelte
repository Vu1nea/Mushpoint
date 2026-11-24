<script lang="ts">
	import { onTimeByDay, type OnTimeDay } from '$lib/dashboard';
	import type { TaskSummary } from '$lib/api';
	import DashboardSectionTitle from './DashboardSectionTitle.svelte';

	interface Props {
		tasks: TaskSummary[];
		class?: string;
	}

	let { tasks, class: className = '' }: Props = $props();

	const W = 320;
	const H = 140;
	const PAD = { top: 10, right: 10, bottom: 22, left: 30 };
	const plotW = W - PAD.left - PAD.right;
	const plotH = H - PAD.top - PAD.bottom;

	const days = $derived(onTimeByDay(tasks));
	const x = (index: number) => PAD.left + (index / (days.length - 1)) * plotW;
	const y = (rate: number) => PAD.top + (1 - rate / 100) * plotH;

	/** Runs of consecutive days with data; a day with nothing due breaks the line. */
	const runs = $derived.by(() => {
		const out: { day: OnTimeDay; index: number }[][] = [];
		days.forEach((day, index) => {
			if (day.rate === null) {
				out.push([]);
			} else {
				if (out.length === 0) out.push([]);
				out[out.length - 1].push({ day, index });
			}
		});
		return out.filter((run) => run.length > 0);
	});
	const points = $derived(runs.flat());

	const totalDue = $derived(days.reduce((sum, day) => sum + day.due, 0));
	const totalOnTime = $derived(days.reduce((sum, day) => sum + day.onTime, 0));
	const average = $derived(totalDue ? Math.round((totalOnTime / totalDue) * 100) : null);

	let hovered = $state<number | null>(null);
	const picked = $derived(hovered === null ? null : days[hovered]);

	const label = (date: string) =>
		new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

	function onMove(event: PointerEvent) {
		const box = (event.currentTarget as SVGElement).getBoundingClientRect();
		const px = ((event.clientX - box.left) / box.width) * W;
		const index = Math.round(((px - PAD.left) / plotW) * (days.length - 1));
		hovered = Math.min(Math.max(index, 0), days.length - 1);
	}
</script>

<section class="dash-card {className}">
	<DashboardSectionTitle title="Done on time">
		{#snippet sub()}
			Last {days.length} days
		{/snippet}
	</DashboardSectionTitle>

	<div class="dash-pad pb-4">
		<p class="mb-1 min-h-5 text-sm text-content tabular-nums" aria-live="polite">
			{#if picked}
				{label(picked.date)}:
				{#if picked.rate === null}
					nothing due
				{:else}
					<b>{picked.rate}%</b>
					<span class="text-muted">({picked.onTime} of {picked.due})</span>
				{/if}
			{:else if average !== null}
				<b>{average}%</b>
				<span class="text-muted">on time overall ({totalOnTime} of {totalDue})</span>
			{:else}
				<span class="text-muted">No tasks were due in this period.</span>
			{/if}
		</p>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<svg
			viewBox="0 0 {W} {H}"
			class="block w-full"
			role="img"
			aria-label="Line chart of the percent of tasks done on time per day, last {days.length} days"
			onpointermove={onMove}
			onpointerleave={() => (hovered = null)}
		>
			{#each [0, 50, 100] as tick (tick)}
				<line
					x1={PAD.left}
					x2={W - PAD.right}
					y1={y(tick)}
					y2={y(tick)}
					class="stroke-subtle"
					stroke-width="1"
				/>
				<text
					x={PAD.left - 6}
					y={y(tick) + 3.5}
					text-anchor="end"
					class="fill-muted text-[10px] tabular-nums">{tick}%</text
				>
			{/each}

			{#each [0, Math.floor((days.length - 1) / 2), days.length - 1] as index (index)}
				<text
					x={x(index)}
					y={H - 6}
					text-anchor={index === 0 ? 'start' : index === days.length - 1 ? 'end' : 'middle'}
					class="fill-muted text-[10px]">{label(days[index].date)}</text
				>
			{/each}

			{#if hovered !== null}
				<line
					x1={x(hovered)}
					x2={x(hovered)}
					y1={PAD.top}
					y2={PAD.top + plotH}
					class="stroke-muted"
					stroke-width="1"
					stroke-dasharray="3 3"
				/>
			{/if}

			{#each runs as run, runIndex (runIndex)}
				{#if run.length > 1}
					<polyline
						points={run.map((p) => `${x(p.index)},${y(p.day.rate ?? 0)}`).join(' ')}
						fill="none"
						class="stroke-accent-ink"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				{/if}
			{/each}

			{#each points as p (p.index)}
				<circle
					cx={x(p.index)}
					cy={y(p.day.rate ?? 0)}
					r={hovered === p.index ? 5 : 4}
					class="fill-accent-ink stroke-surface"
					stroke-width="2"
				/>
			{/each}
		</svg>

		<table class="sr-only">
			<caption>Tasks done on time per day</caption>
			<thead><tr><th>Day</th><th>Due</th><th>On time</th><th>Rate</th></tr></thead>
			<tbody>
				{#each days as day (day.date)}
					<tr>
						<td>{label(day.date)}</td><td>{day.due}</td><td>{day.onTime}</td>
						<td>{day.rate === null ? 'n/a' : `${day.rate}%`}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
