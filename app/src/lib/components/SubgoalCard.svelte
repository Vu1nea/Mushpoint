<script lang="ts">
	import { createTask, deleteSubgoal, setSubgoalComplete, type SubgoalDetail } from '$lib/api';
	import { dueLabel, isOverdue } from '$lib/format';
	import Icon from './Icon.svelte';
	import ProgressBar from './ProgressBar.svelte';
	import TaskRow from './TaskRow.svelte';
	import { button, field } from './ui';

	interface Props {
		subgoal: SubgoalDetail;
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
	}

	let { subgoal, onMutated, onError }: Props = $props();

	let busy = $state(false);
	let newTaskTitle = $state('');

	/** Once a subgoal has tasks they drive its progress, so the checkbox is moot. */
	const checkboxDisabled = $derived(subgoal.tasks.length > 0);

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

	async function addTask(event: SubmitEvent) {
		event.preventDefault();
		const title = newTaskTitle;
		newTaskTitle = '';
		await run(() =>
			createTask({
				title,
				dueDate: null,
				goalId: null,
				subgoalId: subgoal.id,
				isRecurring: false
			})
		);
	}
</script>

<article class="rounded-xl border border-subtle bg-surface p-4">
	<div class="flex items-start gap-3">
		<input
			type="checkbox"
			class="mt-1 size-4 shrink-0 accent-accent"
			checked={subgoal.isComplete}
			disabled={busy || checkboxDisabled}
			title={checkboxDisabled ? 'Completion follows this subgoal’s tasks' : undefined}
			aria-label="Mark {subgoal.title} complete"
			onchange={(event) => run(() => setSubgoalComplete(subgoal.id, event.currentTarget.checked))}
		/>

		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<h3 class="truncate text-sm font-medium">{subgoal.title}</h3>
				{#if subgoal.dueDate}
					<span class="text-xs {isOverdue(subgoal.dueDate) ? 'text-danger' : 'text-muted'}">
						{dueLabel(subgoal.dueDate)}
					</span>
				{/if}
			</div>
			<div class="mt-2 max-w-xs">
				<ProgressBar value={subgoal.progress} label="{subgoal.title} progress" />
			</div>
		</div>

		<button
			type="button"
			class={button.icon}
			disabled={busy}
			onclick={() => run(() => deleteSubgoal(subgoal.id))}
		>
			<Icon name="trash" size={15} label="Delete {subgoal.title}" />
		</button>
	</div>

	{#if subgoal.tasks.length > 0}
		<ul class="mt-3">
			{#each subgoal.tasks as task (task.id)}
				<TaskRow {task} {onMutated} {onError} />
			{/each}
		</ul>
	{/if}

	<form class="mt-3 flex gap-2" onsubmit={addTask}>
		<input
			class="{field.input} py-1.5 text-sm"
			bind:value={newTaskTitle}
			placeholder="Add a task"
			required
			aria-label="New task for {subgoal.title}"
		/>
		<button type="submit" class={button.ghost} disabled={busy}>
			<Icon name="plus" size={15} /> Add
		</button>
	</form>
</article>
