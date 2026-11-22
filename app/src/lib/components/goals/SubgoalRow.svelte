<script lang="ts">
	import { slide } from 'svelte/transition';

	import {
		createTask,
		deleteSubgoal,
		RECURRENCE_OPTIONS,
		setSubgoalComplete,
		type Recurrence,
		type SubgoalDetail
	} from '$lib/api';
	import { dueLabel, dueTone, percent } from '$lib/format';
	import { motion } from '$lib/motion';
	import { optimistic } from '$lib/optimistic';
	import Checkbox from '../ui/Checkbox.svelte';
	import ConfirmDialog from '../ui/ConfirmDialog.svelte';
	import Icon from '../ui/Icon.svelte';
	import ProgressBar from '../ui/ProgressBar.svelte';
	import Select from '../ui/Select.svelte';
	import TaskRow from '../tasks/TaskRow.svelte';
	import { button, field } from '../ui';

	interface Props {
		subgoal: SubgoalDetail;
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
		onEdit: () => void;
		delay?: string;
	}

	let { subgoal, onMutated, onError, onEdit, delay = '0ms' }: Props = $props();

	let expanded = $state(false);
	let busy = $state(false);
	let newTaskTitle = $state('');
	let newTaskRecurrence = $state('');
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

	/** The tick as the user just set it, shown until fresh data arrives. */
	let pendingComplete = $state<boolean | null>(null);

	function toggleComplete(checked: boolean) {
		return optimistic({
			key: `subgoal:${subgoal.id}`,
			apply: () => (pendingComplete = checked),
			revert: () => (pendingComplete = null),
			call: () => setSubgoalComplete(subgoal.id, checked),
			refresh: async () => {
				await onMutated();
			},
			onError,
			settle: () => (pendingComplete = null)
		});
	}

	async function removeSubgoal() {
		confirmingDelete = false;
		await run(() => deleteSubgoal(subgoal.id));
	}

	async function addTask(event: SubmitEvent) {
		event.preventDefault();
		const title = newTaskTitle.trim();
		if (!title) return;
		const recurrence = (newTaskRecurrence || null) as Recurrence | null;
		newTaskTitle = '';
		newTaskRecurrence = '';
		await run(() =>
			createTask({
				title,
				dueDate: null,
				goalId: null,
				subgoalId: subgoal.id,
				recurrence
			})
		);
	}
</script>

<li class="list-none">
	<div class="group flex min-h-11 items-center gap-2.5 py-2 sm:gap-3.5">
		<button
			type="button"
			class="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3.5"
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
				<p class="mb-1 truncate text-sm font-semibold">{subgoal.title}</p>
				<div class="max-w-70">
					<ProgressBar
						value={subgoal.progress}
						label="{subgoal.title} progress"
						showValue={false}
						height={5}
						color="var(--mp-accent-secondary)"
						{delay}
					/>
				</div>
			</div>
			<span class="shrink-0 text-xs text-muted tabular-nums">{percent(subgoal.progress)}</span>
			<span
				class="shrink-0 text-right text-xs sm:min-w-21.5 {dueTone(subgoal.dueDate) === 'overdue'
					? 'text-warn'
					: 'text-muted'}"
			>
				{subgoal.dueDate ? dueLabel(subgoal.dueDate) : ''}
			</span>
		</button>

		<button
			type="button"
			class="{button.bare} mp-hit opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
			onclick={onEdit}
		>
			<Icon name="edit" size={14} label="Edit {subgoal.title}" />
		</button>
		<button
			type="button"
			class="{button.bare} mp-hit opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
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
		{busy}
		onConfirm={removeSubgoal}
		onCancel={() => (confirmingDelete = false)}
	/>

	{#if expanded}
		<div class="flex flex-col gap-2 pb-3 pl-6 sm:pl-8" transition:slide={{ duration: motion(180) }}>
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
					checked={pendingComplete ?? subgoal.isComplete}
					label="Mark {subgoal.title} complete"
					showLabel
					onchange={toggleComplete}
				/>
			{/if}

			<form class="mt-1 flex gap-2" onsubmit={addTask}>
				<input
					class="{field.input} min-w-0 flex-1 py-2 text-sm"
					bind:value={newTaskTitle}
					placeholder="Add a task…"
					aria-label="New task for {subgoal.title}"
				/>
				<Select
					class="w-37.5 shrink-0"
					ariaLabel="New task for {subgoal.title} repeats"
					bind:value={newTaskRecurrence}
					options={RECURRENCE_OPTIONS}
				/>
			</form>
		</div>
	{/if}
</li>
