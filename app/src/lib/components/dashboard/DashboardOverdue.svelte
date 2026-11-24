<script lang="ts">
	import type { TaskSummary } from '$lib/api';
	import { overdueTasks } from '$lib/dashboard';
	import { dueLabel } from '$lib/format';
	import DashboardSectionTitle from './DashboardSectionTitle.svelte';
	import DashboardTaskToggle from './DashboardTaskToggle.svelte';

	interface Props {
		tasks: TaskSummary[];
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
		class?: string;
	}

	let { tasks, onMutated, onError, class: className = '' }: Props = $props();

	const LIMIT = 5;

	/** Oldest first: the longest-waiting task is the one to clear. */
	const overdue = $derived(
		overdueTasks(tasks).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
	);
	const shown = $derived(overdue.slice(0, LIMIT));
</script>

<section class="dash-card {className}">
	<DashboardSectionTitle title="Overdue" tier="lead">
		{#snippet actions()}
			<a
				href="/tasks"
				class="text-xs font-semibold text-muted hover:text-content focus-visible:outline-2 focus-visible:outline-accent"
			>
				View all
			</a>
		{/snippet}
	</DashboardSectionTitle>

	{#if shown.length === 0}
		<p class="dash-pad pb-4 text-sm text-muted">Nothing overdue.</p>
	{:else}
		<ul class="divide-y divide-subtle border-t border-subtle">
			{#each shown as task (task.id)}
				<li class="flex min-h-11 items-center gap-2.5 dash-pad py-2 text-sm">
					<DashboardTaskToggle {task} {onMutated} {onError} />
					<span class="min-w-0 flex-1 truncate">{task.title}</span>
					<span class="shrink-0 text-xs text-warn">{dueLabel(task.dueDate)}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
