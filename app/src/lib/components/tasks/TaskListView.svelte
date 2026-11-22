<script lang="ts">
	import DataTable from 'mushpoint-design/svelte/DataTable.svelte';
	import Pill from 'mushpoint-design/svelte/Pill.svelte';
	import RowMenu from 'mushpoint-design/svelte/RowMenu.svelte';
	import Segmented from 'mushpoint-design/svelte/Segmented.svelte';
	import Toolbar from 'mushpoint-design/svelte/Toolbar.svelte';
	import {
		TASK_STATUS_LABELS,
		TASK_STATUSES,
		type GoalSummary,
		type SubgoalDetail,
		type TaskSummary
	} from '$lib/api';
	import { taskColumn } from '$lib/kanban';
	import { dueLabel, dueTone } from '$lib/format';
	import { statusTone } from '$lib/statusTone';
	import { filterTasks, statusCounts, type TaskListStatus } from '$lib/taskList';
	import DashboardTaskToggle from '../dashboard/DashboardTaskToggle.svelte';
	import { DUE_CLASSES, field } from '../ui';

	interface Props {
		tasks: TaskSummary[];
		goals: GoalSummary[];
		subgoals: Pick<SubgoalDetail, 'id' | 'title'>[];
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
		onEditTask: (task: TaskSummary) => void;
		onDeleteTask: (task: TaskSummary) => void;
	}

	let { tasks, goals, subgoals, onMutated, onError, onEditTask, onDeleteTask }: Props = $props();

	let status = $state<TaskListStatus>('all');
	let query = $state('');

	const rows = $derived(filterTasks(tasks, { status, query }));
	const counts = $derived(statusCounts(tasks));
	const goalTitle = $derived(new Map(goals.map((goal) => [goal.id, goal.title])));
	const subgoalTitle = $derived(new Map(subgoals.map((subgoal) => [subgoal.id, subgoal.title])));

	const options = $derived([
		{ value: 'all' as const, label: 'All', count: counts.all },
		...TASK_STATUSES.map((value) => ({
			value,
			label: TASK_STATUS_LABELS[value],
			count: counts[value]
		}))
	]);

	const empty = $derived(tasks.length === 0 ? 'No tasks yet.' : 'No tasks match.');

	const columns = [
		{ key: 'title', label: 'Task' },
		{ key: 'goal', label: 'Goal', width: '12rem', hideBelow: 'md' as const },
		{ key: 'due', label: 'Due', width: '8rem', hideBelow: 'md' as const },
		{ key: 'status', label: 'Status', width: '7.5rem' },
		{ key: 'actions', label: '', width: '3rem', align: 'end' as const }
	];

	const goalOf = (task: TaskSummary) => (task.goalId ? goalTitle.get(task.goalId) : undefined);
	const subgoalOf = (task: TaskSummary) =>
		task.subgoalId ? subgoalTitle.get(task.subgoalId) : undefined;
	const fullLine = (task: TaskSummary) =>
		[goalOf(task), subgoalOf(task)].filter(Boolean).join(' / ');

	/** Ticks as just set, so a title strikes through before the refresh lands. */
	let ticked = $state<Record<number, boolean>>({});
</script>

<div class="px-4 pb-3 md:px-8">
	<Toolbar>
		<input
			type="search"
			class="{field.input} max-w-64 min-w-40 flex-1"
			placeholder="Search tasks"
			aria-label="Search tasks"
			bind:value={query}
		/>
		<Segmented ariaLabel="Filter tasks by status" {options} bind:value={status} />
	</Toolbar>
</div>

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
						{onMutated}
						{onError}
						onDone={(value) => (ticked[task.id] = value)}
					/>
				</span>
				<div class="min-w-0">
					<p class="truncate {ticked[task.id] ? 'text-muted line-through' : ''}">{task.title}</p>
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
			{@const column = taskColumn(task)}
			{@const shown = ticked[task.id] ? 'done' : column === 'done' ? 'todo' : column}
			<Pill tone={statusTone(shown)}>{TASK_STATUS_LABELS[shown]}</Pill>
		{:else}
			<RowMenu
				label="Actions for {task.title}"
				items={[
					{ label: 'Edit', onSelect: () => onEditTask(task) },
					{ label: 'Delete', danger: true, onSelect: () => onDeleteTask(task) }
				]}
			/>
		{/if}
	{/snippet}
</DataTable>
