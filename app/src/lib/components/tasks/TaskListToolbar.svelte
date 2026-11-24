<script lang="ts">
	import Segmented from 'mushpoint-design/svelte/Segmented.svelte';
	import Toolbar from 'mushpoint-design/svelte/Toolbar.svelte';
	import { TASK_STATUS_LABELS, TASK_STATUSES, type TaskSummary } from '$lib/api';
	import type { TaskListStatus } from '$lib/taskList';
	import { field } from '../ui';

	interface Props {
		tasks: TaskSummary[];
		status: TaskListStatus;
		query: string;
	}

	let { tasks, status = $bindable(), query = $bindable() }: Props = $props();

	const options = [
		{ value: 'all' as const, label: 'All' },
		...TASK_STATUSES.map((value) => ({ value, label: TASK_STATUS_LABELS[value] }))
	];
</script>

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
