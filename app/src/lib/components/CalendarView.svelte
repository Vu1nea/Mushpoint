<!-- app/src/lib/components/CalendarView.svelte -->
<script lang="ts">
	import {
		RECURRENCE_LABELS,
		updateTask,
		type GoalSummary,
		type SubgoalDetail,
		type TaskSummary
	} from '$lib/api';
	import { tasksByDay } from '$lib/calendar';
	import { monthGrid, monthLabel, shiftMonth, todayIso } from '$lib/calendarGrid';
	import { dueTone } from '$lib/format';
	import Icon from './Icon.svelte';
	import { button, DUE_CLASSES } from './ui';

	interface Props {
		goalId?: number | null;
		tasks: TaskSummary[];
		subgoals: Pick<SubgoalDetail, 'id' | 'title'>[];
		goals?: GoalSummary[];
		parentChipMode: 'subgoal-only' | 'goal-and-subgoal';
		onMutated: () => Promise<void> | void;
		onError: (error: unknown) => void;
		onEditTask: (task: TaskSummary) => void;
		onDeleteTask: (task: TaskSummary) => void;
	}

	let { tasks, onMutated, onError, onEditTask }: Props = $props();

	const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
	const CHIPS_SHOWN = 3;

	const [initialYear, initialMonth] = todayIso().split('-').map(Number);
	let viewYear = $state(initialYear);
	let viewMonth = $state(initialMonth - 1);

	let busy = $state(false);
	let dragOverIso = $state<string | null>(null);

	const grid = $derived(monthGrid(viewYear, viewMonth, null, todayIso()));
	const heading = $derived(monthLabel(viewYear, viewMonth));
	const byDay = $derived(
		tasksByDay(
			tasks,
			grid.map((cell) => cell.iso)
		)
	);

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

	function changeMonth(delta: 1 | -1) {
		const next = shiftMonth(viewYear, viewMonth, delta);
		viewYear = next.year;
		viewMonth = next.month;
	}

	function goToday() {
		const [year, month] = todayIso().split('-').map(Number);
		viewYear = year;
		viewMonth = month - 1;
	}

	function dragStart(event: DragEvent, task: TaskSummary) {
		event.dataTransfer?.setData('text/plain', String(task.id));
	}

	function dragOver(event: DragEvent, iso: string) {
		event.preventDefault();
		dragOverIso = iso;
	}

	function dragLeave(iso: string) {
		if (dragOverIso === iso) dragOverIso = null;
	}

	/** Full `TaskUpdate` object — the repo's `update()` requires every field,
	 * same constraint `TaskDrawer`'s save already works within. */
	function reschedule(task: TaskSummary, iso: string) {
		if (task.dueDate === iso) return; // already showing here — no-op
		return run(() =>
			updateTask(task.id, {
				title: task.title,
				status: task.status,
				dueDate: iso,
				goalId: task.goalId,
				subgoalId: task.subgoalId,
				recurrence: task.recurrence
			})
		);
	}

	function drop(event: DragEvent, iso: string) {
		event.preventDefault();
		dragOverIso = null;
		if (busy) return;
		const id = Number(event.dataTransfer?.getData('text/plain'));
		const task = tasks.find((t) => t.id === id);
		if (task) reschedule(task, iso);
	}
</script>

<div class="mb-3.5 flex items-center justify-between gap-2">
	<div class="flex items-center gap-1">
		<button
			type="button"
			class="rounded-control p-1 text-muted transition-colors hover:text-content"
			aria-label="Previous month"
			onclick={() => changeMonth(-1)}
		>
			<Icon name="chevron-right" size={14} weight={2.2} class="rotate-180" />
		</button>
		<h2 class="w-40 text-center text-sm font-semibold">{heading}</h2>
		<button
			type="button"
			class="rounded-control p-1 text-muted transition-colors hover:text-content"
			aria-label="Next month"
			onclick={() => changeMonth(1)}
		>
			<Icon name="chevron-right" size={14} weight={2.2} />
		</button>
	</div>
	<button type="button" class={button.ghost} onclick={goToday}>Today</button>
</div>

<div class="grid grid-cols-7 gap-y-1 text-center">
	{#each WEEKDAYS as weekday (weekday)}
		<span class="text-2xs font-semibold text-muted">{weekday}</span>
	{/each}
</div>

<div class="grid grid-cols-7 gap-px overflow-hidden rounded-card border border-subtle bg-subtle">
	{#each grid as cell (cell.iso)}
		{@const dayTasks = byDay.get(cell.iso) ?? []}
		{@const shown = dayTasks.slice(0, CHIPS_SHOWN)}
		{@const extra = dayTasks.length - shown.length}
		<div
			class="flex min-h-24 flex-col gap-1 bg-surface p-1.5 transition-colors {dragOverIso ===
			cell.iso
				? 'bg-accent/5'
				: ''}"
			ondragover={(event) => dragOver(event, cell.iso)}
			ondragleave={() => dragLeave(cell.iso)}
			ondrop={(event) => drop(event, cell.iso)}
		>
			<span
				class="flex size-5.5 shrink-0 items-center justify-center self-start rounded-full text-2xs font-semibold {cell.inCurrentMonth
					? 'text-content'
					: 'text-muted/50'} {cell.isToday ? 'ring-2 ring-accent' : ''}"
			>
				{cell.day}
			</span>

			{#each shown as task (task.id)}
				<button
					type="button"
					class="flex items-center gap-1 truncate rounded-control bg-surface-raised px-1.5 py-0.5 text-left text-2xs {DUE_CLASSES[
						dueTone(task.dueDate)
					]} {task.recurrence ? '' : 'cursor-grab'}"
					draggable={!task.recurrence}
					ondragstart={(event) => dragStart(event, task)}
					onclick={() => onEditTask(task)}
				>
					{#if task.recurrence}
						<Icon
							name="flame"
							size={10}
							class="shrink-0 text-accent-secondary"
							label={RECURRENCE_LABELS[task.recurrence]}
						/>
					{/if}
					<span class="truncate">{task.title}</span>
				</button>
			{/each}

			{#if extra > 0}
				<span class="px-1.5 text-2xs text-muted/70">+{extra} more</span>
			{/if}
		</div>
	{/each}
</div>
