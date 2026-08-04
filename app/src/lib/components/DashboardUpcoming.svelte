<script lang="ts">
	import type { GoalSummary, Subgoal, TaskSummary } from '$lib/api';
	import { buildUpcomingFeed } from '$lib/dashboard';
	import { dueLabel, dueTone } from '$lib/format';
	import { sectionHeading } from './ui';

	interface Props {
		goals: GoalSummary[];
		subgoals: Subgoal[];
		tasks: TaskSummary[];
		class?: string;
	}

	let { goals, subgoals, tasks, class: className = '' }: Props = $props();

	const DUE_CLASSES = {
		none: 'text-muted',
		later: 'text-muted',
		soon: 'font-semibold text-accent-tertiary',
		overdue: 'font-bold text-warn'
	};

	const KIND_LABELS = { goal: 'Goal', subgoal: 'Subgoal', task: 'Task' };

	const upcoming = $derived(buildUpcomingFeed(goals, subgoals, tasks).slice(0, 8));
</script>

<section class="flex flex-col overflow-y-auto rounded-card border border-subtle bg-surface p-4.5 {className}">
	<h2 class="{sectionHeading} mb-3">Upcoming</h2>

	{#if upcoming.length === 0}
		<p class="flex-1 py-8 text-center text-md text-muted">Nothing due soon.</p>
	{:else}
		<ul class="flex flex-col gap-2.5">
			{#each upcoming as item (`${item.kind}-${item.id}`)}
				<li class="flex items-center gap-2.5 text-sm">
					<span class="w-14 shrink-0 text-2xs font-bold tracking-wider text-muted uppercase">
						{KIND_LABELS[item.kind]}
					</span>
					{#if item.href}
						<a href={item.href} class="min-w-0 flex-1 truncate hover:text-accent">
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
