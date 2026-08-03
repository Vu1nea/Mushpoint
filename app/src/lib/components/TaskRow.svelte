<script lang="ts">
	import {
		deleteTask,
		RECURRENCE_LABELS,
		setTaskCompletion,
		setTaskStatus,
		type TaskSummary
	} from '$lib/api';
	import { dueLabel, dueTone } from '$lib/format';
	import Checkbox from './Checkbox.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import Icon from './Icon.svelte';
	import { button } from './ui';

	interface Props {
		task: TaskSummary;
		/** Called after a successful change so the page can reload its data. */
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
	}

	let { task, onMutated, onError }: Props = $props();
	let busy = $state(false);
	let confirmingDelete = $state(false);

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

	/** A habit has no lasting status — ticking it logs today's completion
	 * instead of writing `status = 'done'`, so it stays in sync with the
	 * board and the streak/heatmap. */
	const done = $derived(task.recurrence ? task.completedToday : task.status === 'done');

	function toggle(checked: boolean) {
		if (task.recurrence) return run(() => setTaskCompletion(task.id, checked));
		return run(() => setTaskStatus(task.id, checked ? 'done' : 'todo'));
	}

	async function removeTask() {
		confirmingDelete = false;
		await run(() => deleteTask(task.id));
	}
</script>

<li class="group flex items-center gap-2.5 py-1 text-md">
	<Checkbox checked={done} label="Mark {task.title} done" disabled={busy} onchange={toggle} />

	<span class="min-w-0 flex-1 truncate {done ? 'text-muted line-through' : ''}">
		{task.title}
	</span>

	{#if task.status === 'in_progress'}
		<span
			class="shrink-0 rounded-full bg-accent-tertiary/20 px-2 py-0.5 text-2xs font-semibold text-accent-tertiary"
		>
			In progress
		</span>
	{/if}

	{#if task.recurrence}
		<span
			class="flex shrink-0 items-center gap-1 rounded-full bg-accent-secondary/15 px-2 py-0.5 text-2xs font-semibold text-accent-secondary"
		>
			<Icon name="flame" size={12} />
			{RECURRENCE_LABELS[task.recurrence]}
		</span>
	{/if}

	{#if task.dueDate}
		<span
			class="shrink-0 text-2xs {dueTone(task.dueDate) === 'overdue' ? 'text-warn' : 'text-muted'}"
		>
			{dueLabel(task.dueDate)}
		</span>
	{/if}

	<button
		type="button"
		class="{button.bare} opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
		disabled={busy}
		onclick={() => (confirmingDelete = true)}
	>
		<Icon name="trash" size={14} label="Delete {task.title}" />
	</button>

	<ConfirmDialog
		open={confirmingDelete}
		title="Delete “{task.title}”?"
		body="The task is removed from the board. This cannot be undone."
		busy={busy}
		onConfirm={removeTask}
		onCancel={() => (confirmingDelete = false)}
	/>
</li>
