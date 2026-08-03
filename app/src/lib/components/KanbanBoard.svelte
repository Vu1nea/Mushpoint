<!-- app/src/lib/components/KanbanBoard.svelte -->
<script lang="ts">
	import { flip } from 'svelte/animate';

	import {
		createTask,
		RECURRENCE_LABELS,
		setTaskStatus,
		TASK_STATUS_LABELS,
		TASK_STATUSES,
		type SubgoalDetail,
		type TaskStatus,
		type TaskSummary
	} from '$lib/api';
	import { dueLabel, dueTone } from '$lib/format';
	import { groupByStatus } from '$lib/kanban';
	import { motion } from '$lib/motion';
	import Icon from './Icon.svelte';
	import { button, field, sectionHeading } from './ui';

	interface Props {
		goalId: number;
		tasks: TaskSummary[];
		subgoals: SubgoalDetail[];
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
		onEditTask: (task: TaskSummary) => void;
	}

	let { goalId, tasks, subgoals, onMutated, onError, onEditTask }: Props = $props();

	let busy = $state(false);
	let dragOverStatus = $state<TaskStatus | null>(null);
	let newTaskTitles = $state<Record<TaskStatus, string>>({
		todo: '',
		in_progress: '',
		done: ''
	});

	const subgoalNames = $derived(new Map(subgoals.map((s) => [s.id, s.title])));
	const columns = $derived(groupByStatus(tasks));

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

	function moveTask(taskId: number, status: TaskStatus) {
		return run(() => setTaskStatus(taskId, status));
	}

	/** One column left/right; a no-op past either edge. */
	function step(task: TaskSummary, direction: 1 | -1) {
		const next = TASK_STATUSES[TASK_STATUSES.indexOf(task.status) + direction];
		if (next) moveTask(task.id, next);
	}

	function dragStart(event: DragEvent, task: TaskSummary) {
		event.dataTransfer?.setData('text/plain', String(task.id));
	}

	function dragOver(event: DragEvent, status: TaskStatus) {
		event.preventDefault();
		dragOverStatus = status;
	}

	function dragLeave(status: TaskStatus) {
		if (dragOverStatus === status) dragOverStatus = null;
	}

	function drop(event: DragEvent, status: TaskStatus) {
		event.preventDefault();
		dragOverStatus = null;
		const id = Number(event.dataTransfer?.getData('text/plain'));
		if (Number.isInteger(id)) moveTask(id, status);
	}

	async function quickAdd(event: SubmitEvent, status: TaskStatus) {
		event.preventDefault();
		const title = newTaskTitles[status].trim();
		if (!title) return;

		newTaskTitles[status] = '';
		await run(async () => {
			const created = await createTask({
				title,
				dueDate: null,
				goalId,
				subgoalId: null,
				recurrence: null
			});
			if (status !== 'todo') await setTaskStatus(created.id, status);
		});
	}
</script>

<div class="grid gap-4 md:grid-cols-3">
	{#each TASK_STATUSES as status (status)}
		<section
			class="flex min-h-50 flex-col gap-2.5 rounded-card border p-3.5 transition-colors {dragOverStatus ===
			status
				? 'border-accent bg-accent/5'
				: 'border-subtle bg-surface'}"
			ondragover={(event) => dragOver(event, status)}
			ondragleave={() => dragLeave(status)}
			ondrop={(event) => drop(event, status)}
		>
			<h2 class="flex justify-between {sectionHeading} text-xs">
				<span>{TASK_STATUS_LABELS[status]}</span>
				<span class="tabular-nums">{columns[status].length}</span>
			</h2>

			{#each columns[status] as task (task.id)}
				{@const subgoalName = task.subgoalId ? subgoalNames.get(task.subgoalId) : null}
				<div
					class="group rounded-card border border-subtle bg-background p-3.5"
					draggable="true"
					ondragstart={(event) => dragStart(event, task)}
					animate:flip={{ duration: motion(200) }}
				>
					<button
						type="button"
						class="block w-full text-left text-sm font-semibold"
						onclick={() => onEditTask(task)}
					>
						{task.title}
					</button>

					<div class="mt-2 flex flex-wrap items-center gap-2">
						{#if subgoalName}
							<span
								class="max-w-32 truncate rounded-full bg-accent/15 px-2.5 py-0.5 text-2xs font-semibold text-accent"
							>
								{subgoalName}
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
								class="shrink-0 text-2xs {dueTone(task.dueDate) === 'overdue'
									? 'text-warn'
									: 'text-muted'}"
							>
								{dueLabel(task.dueDate)}
							</span>
						{/if}
					</div>

					<div class="mt-2 flex justify-end gap-1">
						{#if status !== 'todo'}
							<button
								type="button"
								class={button.bare}
								disabled={busy}
								onclick={() => step(task, -1)}
							>
								<Icon name="chevron-right" size={13} class="rotate-180" label="Move {task.title} left" />
							</button>
						{/if}
						{#if status !== 'done'}
							<button
								type="button"
								class={button.bare}
								disabled={busy}
								onclick={() => step(task, 1)}
							>
								<Icon name="chevron-right" size={13} label="Move {task.title} right" />
							</button>
						{/if}
					</div>
				</div>
			{/each}

			{#if columns[status].length === 0}
				<p class="px-2 py-6 text-center text-xs text-muted/70">No tasks</p>
			{/if}

			<form class="mt-auto" onsubmit={(event) => quickAdd(event, status)}>
				<input
					class="{field.dashed} w-full text-sm"
					bind:value={newTaskTitles[status]}
					placeholder="+ Add a task…"
					aria-label="New task in {TASK_STATUS_LABELS[status]}"
				/>
			</form>
		</section>
	{/each}
</div>
