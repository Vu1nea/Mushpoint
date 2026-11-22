<script lang="ts">
	import SectionHeader from 'mushpoint-design/svelte/SectionHeader.svelte';
	import type { GoalSummary, Subgoal, TaskSummary } from '$lib/api';
	import { buildUpcomingFeed } from '$lib/dashboard';
	import { dueLabel, dueTone } from '$lib/format';
	import { DUE_CLASSES } from '../ui';

	interface Props {
		goals: GoalSummary[];
		subgoals: Subgoal[];
		tasks: TaskSummary[];
		class?: string;
	}

	let { goals, subgoals, tasks, class: className = '' }: Props = $props();

	const KIND_LABELS = { goal: 'Goal', subgoal: 'Subgoal', task: 'Task' };

	const upcoming = $derived(buildUpcomingFeed(goals, subgoals, tasks).slice(0, 8));
</script>

<section class="section-gutter {className}">
	<SectionHeader title="Upcoming" count={upcoming.length} />

	{#if upcoming.length === 0}
		<p class="page-gutter py-3 text-sm text-muted">Nothing due soon.</p>
	{:else}
		<ul class="divide-y divide-subtle">
			{#each upcoming as item (`${item.kind}-${item.id}`)}
				<li class="flex items-center gap-3 page-gutter py-2 text-sm">
					<span class="w-16 shrink-0 text-2xs font-bold tracking-wider text-muted uppercase">
						{KIND_LABELS[item.kind]}
					</span>
					{#if item.href}
						<a
							href={item.href}
							class="min-w-0 flex-1 truncate focus-visible:outline-2 focus-visible:outline-accent"
						>
							{item.title}
							{#if item.parentLabel}
								<span class="text-muted">· {item.parentLabel}</span>
							{/if}
						</a>
					{:else}
						<span class="min-w-0 flex-1 truncate">{item.title}</span>
					{/if}
					<span class="shrink-0 text-xs {DUE_CLASSES[dueTone(item.dueDate)]}">
						{dueLabel(item.dueDate)}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
