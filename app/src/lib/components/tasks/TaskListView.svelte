<script lang="ts">
	import DataTable from 'mushpoint-design/svelte/DataTable.svelte';
	import Pill from 'mushpoint-design/svelte/Pill.svelte';
	import RowMenu from 'mushpoint-design/svelte/RowMenu.svelte';
	import {
		TASK_STATUS_LABELS,
		type GoalSummary,
		type SubgoalDetail,
		type TaskSummary
	} from '$lib/api';
	import { taskColumn } from '$lib/kanban';
	import { dueLabel, dueTone } from '$lib/format';
	import { statusTone } from '$lib/statusTone';
	import { displayColumn, filterTasks, isInertToday, type TaskListStatus } from '$lib/taskList';
	import DashboardTaskToggle from '../dashboard/DashboardTaskToggle.svelte';
	import { DUE_CLASSES } from '../ui';

	interface Props {
		tasks: TaskSummary[];
		/** Set by the toolbar above the task views. */
		status: TaskListStatus;
		query: string;
		goals: GoalSummary[];
		subgoals: Pick<SubgoalDetail, 'id' | 'title'>[];
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
		onEditTask: (task: TaskSummary) => void;
		onDeleteTask: (task: TaskSummary) => void;
	}

	let {
		tasks,
		status,
		query,
		goals,
		subgoals,
		onMutated,
		onError,
		onEditTask,
		onDeleteTask
	}: Props = $props();

	const rows = $derived(filterTasks(tasks, { status, query }));
	const goalTitle = $derived(new Map(goals.map((goal) => [goal.id, goal.title])));
	const subgoalTitle = $derived(new Map(subgoals.map((subgoal) => [subgoal.id, subgoal.title])));

	const empty = $derived(tasks.length === 0 ? 'No tasks yet.' : 'No tasks match.');

	const columns = [
		{ key: 'title', label: 'Task' },
		{ key: 'goal', label: 'Goal', width: '8rem', hideBelow: 'md' as const },
		{ key: 'due', label: 'Due', width: '6.5rem', hideBelow: 'md' as const },
		{ key: 'status', label: 'Status', width: '6.5rem' },
		{ key: 'actions', label: '', width: '3.5rem', align: 'end' as const }
	];

	const goalOf = (task: TaskSummary) => (task.goalId ? goalTitle.get(task.goalId) : undefined);
	const subgoalOf = (task: TaskSummary) =>
		task.subgoalId ? subgoalTitle.get(task.subgoalId) : undefined;
	const fullLine = (task: TaskSummary) =>
		[goalOf(task), subgoalOf(task)].filter(Boolean).join(' / ');

	/** Ticks as just set, so a title strikes through before the refresh lands. */
	let ticked = $state<Record<number, boolean>>({});
	/** The checkbox state, but only while it differs from server data. */
	const shownColumn = (task: TaskSummary) => {
		const tick = ticked[task.id];
		return displayColumn(task, tick === (taskColumn(task) === 'done') ? undefined : tick);
	};
</script>

<div class="page-gutter [&_[role=row]:not(:first-child)]:rounded-control">
	<DataTable
		{columns}
		{rows}
		rowKey={(task) => task.id}
		{empty}
		ariaLabel="Tasks"
		onRowClick={onEditTask}
	>
		{#snippet cell(task, key)}
			{#if key === 'title'}
				<div class="flex items-center gap-2.5">
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
					<span class="shrink-0" onclick={(event) => event.stopPropagation()}>
						<DashboardTaskToggle
							{task}
							disabled={isInertToday(task)}
							{onMutated}
							{onError}
							onDone={(value) => (ticked[task.id] = value)}
						/>
					</span>
					<div class="min-w-0">
						<p
							class="line-clamp-2 whitespace-normal {shownColumn(task) === 'done'
								? 'text-muted line-through'
								: ''}"
						>
							{task.title}
						</p>
						{#if isInertToday(task)}
							<p class="truncate text-xs text-muted">Not due today</p>
						{/if}
						{#if fullLine(task)}
							<p class="truncate text-xs text-muted md:hidden">{fullLine(task)}</p>
						{/if}
						{#if subgoalOf(task)}
							<p class="truncate text-xs text-muted max-md:hidden">{subgoalOf(task)}</p>
						{/if}
					</div>
				</div>
			{:else if key === 'goal'}
				<span class="text-xs text-muted">
					{task.goalId ? (goalTitle.get(task.goalId) ?? '') : ''}
				</span>
			{:else if key === 'due'}
				<span class="text-xs {DUE_CLASSES[dueTone(task.dueDate)]}">
					{task.dueDate ? dueLabel(task.dueDate) : ''}
				</span>
			{:else if key === 'status'}
				<Pill tone={statusTone(shownColumn(task))}>{TASK_STATUS_LABELS[shownColumn(task)]}</Pill>
			{:else}
				<RowMenu
					label="Actions for {task.title}"
					items={[
						{ label: 'Edit', icon: 'edit', onSelect: () => onEditTask(task) },
						{ label: 'Delete', icon: 'trash', danger: true, onSelect: () => onDeleteTask(task) }
					]}
				/>
			{/if}
		{/snippet}
	</DataTable>
</div>
