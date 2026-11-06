<!-- app/src/lib/components/CalendarView.svelte -->
<script lang="ts">
	import { scale } from 'svelte/transition';

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
	import { motion } from '$lib/motion';
	import { portal } from '$lib/popover.svelte';
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
		onCreateTask: (iso: string) => void;
	}

	let { tasks, onMutated, onError, onEditTask, onCreateTask }: Props = $props();

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

	const DAY_PANEL_WIDTH = 256;
	const VIEWPORT_MARGIN = 8;

	/** The day whose full task list is showing in the "+N more" popup. */
	let openDay = $state<string | null>(null);
	let dayPanel = $state<HTMLElement>();
	let dayPanelClose = $state<HTMLElement>();
	let dayPanelTop = $state(0);
	let dayPanelLeft = $state(0);
	let dayPanelOpener: HTMLElement | undefined;

	/** Opens over the day's cell, centered on it, like a calendar's day popup. */
	function showDay(event: MouseEvent, iso: string) {
		dayPanelOpener = event.currentTarget as HTMLElement;
		const cell = dayPanelOpener.parentElement!.getBoundingClientRect();
		const centered = cell.left + cell.width / 2 - DAY_PANEL_WIDTH / 2;
		const maxLeft = window.innerWidth - DAY_PANEL_WIDTH - VIEWPORT_MARGIN;
		dayPanelLeft = Math.max(VIEWPORT_MARGIN, Math.min(centered, maxLeft));
		dayPanelTop = cell.top;
		openDay = iso;
	}

	function closeDay() {
		openDay = null;
		dayPanelOpener?.focus();
	}

	// Height is only known once mounted, so a tall list near the bottom of the
	// window is pulled back up here.
	$effect(() => {
		if (!dayPanel) return;
		const maxTop = window.innerHeight - dayPanel.offsetHeight - VIEWPORT_MARGIN;
		dayPanelTop = Math.max(VIEWPORT_MARGIN, Math.min(dayPanelTop, maxTop));
		dayPanelClose?.focus();
	});

	function handleKeydown(event: KeyboardEvent) {
		if (openDay && event.key === 'Escape') closeDay();
	}

	function weekdayLabel(iso: string) {
		return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
	}

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

<svelte:window onkeydown={handleKeydown} onresize={() => (openDay = null)} />

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
			class="relative flex min-h-24 flex-col gap-1 p-1.5 transition-colors {dragOverIso === cell.iso
				? 'bg-accent/5'
				: 'bg-surface'}"
			ondragover={(event) => dragOver(event, cell.iso)}
			ondragleave={() => dragLeave(cell.iso)}
			ondrop={(event) => drop(event, cell.iso)}
		>
			<!-- A sibling layer rather than a wrapper: the chips are buttons too, and
			     buttons can't nest. Chips sit above it, so they keep their own clicks. -->
			<button
				type="button"
				class="absolute inset-0"
				aria-label="New task on {cell.iso}"
				onclick={() => onCreateTask(cell.iso)}
			></button>

			<span
				class="flex size-5.5 shrink-0 items-center justify-center self-start rounded-full text-2xs font-semibold {cell.inCurrentMonth
					? 'text-content'
					: 'text-muted/50'} {cell.isToday ? 'ring-2 ring-accent' : ''}"
			>
				{cell.day}
			</span>

			{#each shown as task (task.id)}
				{@render taskChip(task, !task.recurrence)}
			{/each}

			{#if extra > 0}
				<button
					type="button"
					class="relative self-start rounded-control px-1.5 text-2xs font-semibold text-muted transition-colors hover:text-content"
					aria-haspopup="dialog"
					aria-expanded={openDay === cell.iso}
					onclick={(event) => showDay(event, cell.iso)}
				>
					+{extra} more
				</button>
			{/if}
		</div>
	{/each}
</div>

{#snippet taskChip(task: TaskSummary, draggable: boolean)}
	<button
		type="button"
		class="relative flex items-center gap-1 truncate rounded-control bg-surface-raised px-1.5 py-0.5 text-left text-2xs transition-colors hover:bg-accent/25 {DUE_CLASSES[
			dueTone(task.dueDate)
		]}"
		{draggable}
		ondragstart={(event) => dragStart(event, task)}
		onclick={() => {
			openDay = null;
			onEditTask(task);
		}}
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
{/snippet}

{#if openDay}
	{@const day = openDay}
	<div use:portal>
		<button
			type="button"
			class="fixed inset-0 z-40 cursor-default"
			aria-label="Close day"
			onclick={closeDay}
		></button>

		<div
			bind:this={dayPanel}
			class="fixed z-50 flex max-h-[70vh] w-64 flex-col rounded-card border border-subtle bg-surface p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
			style="top:{dayPanelTop}px;left:{dayPanelLeft}px"
			role="dialog"
			aria-label="Tasks on {day}"
			transition:scale={{ start: 0.96, duration: motion(140) }}
		>
			<button
				bind:this={dayPanelClose}
				type="button"
				class="{button.bare} absolute top-2.5 right-2.5"
				onclick={closeDay}
			>
				<Icon name="close" size={15} weight={2} label="Close" />
			</button>

			<div class="mb-2.5 text-center">
				<p class="text-2xs font-semibold tracking-wider text-muted uppercase">
					{weekdayLabel(day)}
				</p>
				<p class="font-display text-xl font-bold">{Number(day.slice(8))}</p>
			</div>

			<div class="flex min-h-0 flex-col gap-1 overflow-y-auto">
				{#each byDay.get(day) ?? [] as task (task.id)}
					{@render taskChip(task, false)}
				{/each}
			</div>
		</div>
	</div>
{/if}
