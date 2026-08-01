<script lang="ts">
	import { deleteTask, RECURRENCE_LABELS, setTaskStatus, type Task } from '$lib/api';
	import { dueLabel, dueTone } from '$lib/format';
	import Checkbox from './Checkbox.svelte';
	import Icon from './Icon.svelte';
	import { button } from './ui';

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

	const done = $derived(task.status === 'done');
</script>

<li class="group flex items-center gap-2.5 py-1 text-[13.5px]">
	<Checkbox
		checked={done}
		label="Mark {task.title} done"
		disabled={busy}
		onchange={(checked) => run(() => setTaskStatus(task.id, checked ? 'done' : 'todo'))}
	/>

	<span class="min-w-0 flex-1 truncate {done ? 'text-muted line-through' : ''}">
		{task.title}
	</span>

	{#if task.status === 'in_progress'}
		<span
			class="shrink-0 rounded-full bg-accent-tertiary/20 px-2 py-0.5 text-[11px] font-semibold text-accent-tertiary"
		>
			In progress
		</span>
	{/if}

	{#if task.recurrence}
		<span
			class="flex shrink-0 items-center gap-1 rounded-full bg-accent-secondary/15 px-2 py-0.5 text-[11px] font-semibold text-accent-secondary"
		>
			<Icon name="flame" size={12} />
			{RECURRENCE_LABELS[task.recurrence]}
		</span>
	{/if}

	{#if task.dueDate}
		<span
			class="shrink-0 text-[11.5px] {dueTone(task.dueDate) === 'overdue'
				? 'text-warn'
				: 'text-muted'}"
		>
			{dueLabel(task.dueDate)}
		</span>
	{/if}

	<button
		type="button"
		class="{button.bare} opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
		disabled={busy}
		onclick={() => run(() => deleteTask(task.id))}
	>
		<Icon name="trash" size={14} label="Delete {task.title}" />
	</button>
</li>
