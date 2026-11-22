<script lang="ts">
	import DataTable from 'mushpoint-design/svelte/DataTable.svelte';
	import Pill from 'mushpoint-design/svelte/Pill.svelte';
	import SectionHeader from 'mushpoint-design/svelte/SectionHeader.svelte';
	import Segmented from 'mushpoint-design/svelte/Segmented.svelte';
	import type { GoalSummary, TaskSummary } from '$lib/api';
	import { todaysTasks } from '$lib/dashboard';
	import { dueLabel, dueTone } from '$lib/format';
	import { taskColumn } from '$lib/kanban';
	import { statusTone } from '$lib/statusTone';
	import { displayColumn, isInertToday } from '$lib/taskList';
	import { TASK_STATUS_LABELS } from '$lib/api';
	import DashboardTaskToggle from './DashboardTaskToggle.svelte';

	interface Props {
		tasks: TaskSummary[];
		goals: GoalSummary[];
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
		class?: string;
	}

	type Filter = 'all' | 'open' | 'done';

	let { tasks, goals, onMutated, onError, class: className = '' }: Props = $props();

	const today = $derived(todaysTasks(tasks));
	const goalTitle = $derived(new Map(goals.map((goal) => [goal.id, goal.title])));

	/** Ticks as just set, so the strike-through, pill and counts agree before the refresh lands. */
	let ticked = $state<Record<number, boolean>>({});
	/** The checkbox state, but only while it differs from server data. */
	const shownColumn = (task: TaskSummary) => {
		const tick = ticked[task.id];
		return displayColumn(task, tick === (taskColumn(task) === 'done') ? undefined : tick);
	};
	const isDone = (task: TaskSummary) => shownColumn(task) === 'done';

	let filter = $state<Filter>('all');

	const open = $derived(today.filter((task) => !isDone(task)));
	const finished = $derived(today.filter(isDone));
	const rows = $derived(filter === 'open' ? open : filter === 'done' ? finished : today);
	const empty = $derived(
		filter === 'open'
			? 'No open tasks today.'
			: filter === 'done'
				? 'Nothing done yet today.'
				: 'Nothing due today.'
	);

	const options = $derived([
		{ value: 'all' as const, label: 'All', count: today.length },
		{ value: 'open' as const, label: 'Open', count: open.length },
		{ value: 'done' as const, label: 'Done', count: finished.length }
	]);

	const columns = [
		{ key: 'title', label: 'Task' },
		{ key: 'due', label: 'Due', width: '9rem', hideBelow: 'md' as const },
		{ key: 'status', label: 'Status', width: '7.5rem' }
	];
</script>

<section class="section-gutter {className}">
	<SectionHeader title="Tasks today" count={today.length}>
		{#snippet actions()}
			<Segmented ariaLabel="Filter today's tasks" {options} bind:value={filter} />
		{/snippet}
	</SectionHeader>

	<div class="page-gutter">
		<DataTable {columns} {rows} rowKey={(task) => task.id} {empty} ariaLabel="Tasks due today">
			{#snippet cell(task, key)}
				{#if key === 'title'}
					<div class="flex items-center gap-2.5">
						<DashboardTaskToggle
							{task}
							disabled={isInertToday(task)}
							{onMutated}
							{onError}
							onDone={(value) => (ticked[task.id] = value)}
						/>
						<div class="min-w-0">
							<p class="truncate {isDone(task) ? 'text-muted line-through' : ''}">{task.title}</p>
							{#if task.goalId && goalTitle.get(task.goalId)}
								<a
									href="/goals/{task.goalId}"
									class="block truncate text-xs text-muted hover:text-content focus-visible:outline-2 focus-visible:outline-accent"
								>
									{goalTitle.get(task.goalId)}
								</a>
							{/if}
						</div>
					</div>
				{:else if key === 'due'}
					<span class="text-xs {dueTone(task.dueDate) === 'overdue' ? 'text-warn' : 'text-muted'}">
						{task.recurrence ? 'Repeats' : dueLabel(task.dueDate)}
					</span>
				{:else}
					<Pill tone={statusTone(shownColumn(task))}>{TASK_STATUS_LABELS[shownColumn(task)]}</Pill>
				{/if}
			{/snippet}
		</DataTable>
	</div>
</section>
