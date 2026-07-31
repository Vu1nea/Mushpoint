<script lang="ts">
	import {
		deleteTask,
		setTaskStatus,
		TASK_STATUS_LABELS,
		TASK_STATUSES,
		type Task,
		type TaskStatus
	} from '$lib/api';
	import { dueLabel, isOverdue } from '$lib/format';
	import { button, field } from './ui';
	import Icon from './Icon.svelte';

	interface Props {
		task: Task;
		/** Called after a successful change so the page can reload its data. */
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
	}

	let { task, onMutated, onError }: Props = $props();
	let busy = $state(false);

	async function run(action: () => Promise<unknown>) {
		busy = true;
		try {
			await action();
			await onMutated();
		} catch (error) {
			onError(error);
		} finally {
			busy = false;
		}
	}

	const changeStatus = (event: Event) =>
		run(() =>
			setTaskStatus(task.id, (event.currentTarget as HTMLSelectElement).value as TaskStatus)
		);
</script>

<li class="flex items-center gap-3 border-b border-subtle py-2 last:border-b-0">
	<select
		class="{field.input} w-32 shrink-0 py-1 text-xs"
		value={task.status}
		disabled={busy}
		aria-label="Status of {task.title}"
		onchange={changeStatus}
	>
		{#each TASK_STATUSES as status (status)}
			<option value={status}>{TASK_STATUS_LABELS[status]}</option>
		{/each}
	</select>

	<span
		class="min-w-0 flex-1 truncate text-sm {task.status === 'done'
			? 'text-muted line-through'
			: ''}"
	>
		{task.title}
	</span>

	{#if task.isRecurring}
		<span class="flex items-center gap-1 text-xs text-accent-secondary">
			<Icon name="flame" size={14} /> recurring
		</span>
	{/if}

	{#if task.dueDate}
		<span class="text-xs {isOverdue(task.dueDate) ? 'text-danger' : 'text-muted'}">
			{dueLabel(task.dueDate)}
		</span>
	{/if}

	<button
		type="button"
		class={button.icon}
		disabled={busy}
		onclick={() => run(() => deleteTask(task.id))}
	>
		<Icon name="trash" size={15} label="Delete {task.title}" />
	</button>
</li>
