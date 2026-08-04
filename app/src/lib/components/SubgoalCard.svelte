<script lang="ts">
	import { slide } from 'svelte/transition';

	import { createTask, deleteSubgoal, setSubgoalComplete, type SubgoalDetail } from '$lib/api';
	import { dueLabel, dueTone, percent } from '$lib/format';
	import { motion } from '$lib/motion';
	import Checkbox from './Checkbox.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import Icon from './Icon.svelte';
	import ProgressBar from './ProgressBar.svelte';
	import TaskRow from './TaskRow.svelte';
	import { button, field } from './ui';

	interface Props {
		subgoal: SubgoalDetail;
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
		delay?: string;
	}

	let { subgoal, onMutated, onError, delay = '0ms' }: Props = $props();

	let expanded = $state(false);
	let busy = $state(false);
	let newTaskTitle = $state('');
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

	async function removeSubgoal() {
		confirmingDelete = false;
		await run(() => deleteSubgoal(subgoal.id));
	}

	async function addTask(event: SubmitEvent) {
		event.preventDefault();
		const title = newTaskTitle.trim();
		if (!title) return;
		newTaskTitle = '';
		await run(() =>
			createTask({
				title,
				dueDate: null,
				goalId: null,
				subgoalId: subgoal.id,
				recurrence: null
			})
		);
	}
</script>

<article class="overflow-hidden rounded-card border border-subtle bg-surface">
	<div class="group flex items-center gap-3.5 px-4 py-3.5">
		<button
			type="button"
			class="flex min-w-0 flex-1 items-center gap-3.5 text-left"
			aria-expanded={expanded}
			onclick={() => (expanded = !expanded)}
		>
			<Icon
				name="chevron-right"
				size={14}
				weight={2.4}
				class="text-muted transition-transform duration-200 {expanded ? 'rotate-90' : ''}"
			/>
			<div class="min-w-0 flex-1">
				<p class="mb-1.5 truncate text-md font-semibold">{subgoal.title}</p>
				<div class="max-w-[280px]">
					<ProgressBar
						value={subgoal.progress}
						label="{subgoal.title} progress"
						showValue={false}
						height={6}
						color="var(--mp-accent-secondary)"
						{delay}
					/>
				</div>
			</div>
			<span class="shrink-0 text-xs text-muted tabular-nums">{percent(subgoal.progress)}</span>
			<span
				class="min-w-[70px] shrink-0 text-right text-2xs {dueTone(subgoal.dueDate) ===
				'overdue'
					? 'text-warn'
					: 'text-muted'}"
			>
				{subgoal.dueDate ? dueLabel(subgoal.dueDate) : ''}
			</span>
		</button>

		<button
			type="button"
			class="{button.bare} opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
			disabled={busy}
			onclick={() => (confirmingDelete = true)}
		>
			<Icon name="trash" size={14} label="Delete {subgoal.title}" />
		</button>
	</div>

	<ConfirmDialog
		open={confirmingDelete}
		title="Delete “{subgoal.title}”?"
		body="Its tasks stay, moved to the goal directly. This cannot be undone."
		busy={busy}
		onConfirm={removeSubgoal}
		onCancel={() => (confirmingDelete = false)}
	/>

	{#if expanded}
		<div
			class="flex flex-col gap-2 pt-0 pr-4 pb-4 pl-11"
			transition:slide={{ duration: motion(180) }}
		>
			{#if subgoal.tasks.length > 0}
				<ul class="flex flex-col">
					{#each subgoal.tasks as task (task.id)}
						<TaskRow {task} {onMutated} {onError} />
					{/each}
				</ul>
			{/if}
			{#if !subgoal.tasks.some((task) => task.recurrence === null)}
				<!-- The backend averages only tasks that count toward progress (recurrence
				     is null); habits are excluded. With no such task, there is nothing to
				     average, so the subgoal's own checkbox is its progress instead. -->
				<Checkbox
					checked={subgoal.isComplete}
					label="Mark {subgoal.title} complete"
					showLabel
					disabled={busy}
					onchange={(checked) => run(() => setSubgoalComplete(subgoal.id, checked))}
				/>
			{/if}

			<form class="mt-1" onsubmit={addTask}>
				<input
					class="{field.input} py-2 text-sm"
					bind:value={newTaskTitle}
					placeholder="Add a task…"
					aria-label="New task for {subgoal.title}"
				/>
			</form>
		</div>
	{/if}
</article>
