<script lang="ts">
	import type { GoalDetail } from '$lib/api';
	import { todayIso } from '$lib/calendarGrid';
	import { ganttChart } from '$lib/gantt';

	interface Props {
		goal: Pick<GoalDetail, 'subgoals' | 'directTasks' | 'dueDate'>;
	}

	let { goal }: Props = $props();

	const chart = $derived(ganttChart(goal, todayIso()));

	function barClass(row: { done: boolean; overdue: boolean; kind: 'subgoal' | 'task' }) {
		if (row.done) return 'bg-muted/40';
		if (row.overdue) return 'bg-warn';
		return row.kind === 'subgoal' ? 'bg-accent' : 'bg-accent-secondary';
	}
</script>

{#if chart.rows.length === 0}
	<p class="rounded-card border border-subtle bg-surface px-4 py-8 text-center text-sm text-muted">
		Give a subgoal or direct task a due date to see it here.
	</p>
{:else}
	<div class="rounded-card border border-subtle bg-surface p-4">
		<div class="mb-2 flex justify-between text-2xs text-muted tabular-nums md:pl-[34%]">
			<span>{chart.start}</span>
			<span>{chart.end}</span>
		</div>

		<ul class="flex flex-col gap-2.5 md:gap-1.5">
			{#each chart.rows as row (row.key)}
				<!-- Phones: title above a full-width bar. md+: title in a side column. -->
				<li class="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
					<span class="shrink-0 truncate text-xs md:w-[33%]" title={row.title}>{row.title}</span>
					<div class="relative h-5 rounded-control bg-background md:flex-1">
						<div
							class="absolute inset-y-0 w-px bg-accent/60"
							style="left:{chart.todayLeft}%"
							aria-hidden="true"
						></div>
						<div
							class="absolute inset-y-1 min-w-1 rounded-full {barClass(row)}"
							style="left:{row.left}%;width:{row.width}%"
							title="{row.title}: {row.start} to {row.end}"
						></div>
					</div>
				</li>
			{/each}
		</ul>

		{#if chart.undated > 0}
			<p class="mt-3 text-2xs text-muted">
				{chart.undated} more with no due date, so not shown.
			</p>
		{/if}
	</div>
{/if}
