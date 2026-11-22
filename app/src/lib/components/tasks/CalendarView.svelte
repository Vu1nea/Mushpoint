<!-- app/src/lib/components/tasks/CalendarView.svelte -->
<script lang="ts">
	import { tick } from 'svelte';
	import { scale } from 'svelte/transition';

	import {
		RECURRENCE_LABELS,
		updateTask,
		type GoalSummary,
		type SubgoalDetail,
		type TaskSummary
	} from '$lib/api';
	import { shiftYear, tasksByDay } from '$lib/calendar';
	import {
		dayDots,
		dayKeyTarget,
		defaultSelectedDay,
		monthGrid,
		monthLabel,
		shiftMonth,
		todayIso,
		type DotTone
	} from '$lib/calendarGrid';
	import { dueTone } from '$lib/format';
	import { motion } from '$lib/motion';
	import { portal } from '$lib/popover.svelte';
	import Icon from '../ui/Icon.svelte';
	import { button, DUE_CLASSES } from '../ui';

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
	const DOT_CLASSES: Record<DotTone, string> = {
		task: 'bg-accent',
		habit: 'bg-accent-secondary',
		overdue: 'bg-warn',
		done: 'bg-muted/50'
	};
	/** Month-nav icon buttons: a 40px tap target on phones, the compact size from md up. */
	const NAV_BUTTON =
		'flex size-10 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:text-content md:size-auto md:p-1';

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

	/**
	 * Phones only: the day whose tasks list under the grid. Tapping a cell picks
	 * it; until then (and after the month changes) it falls back to today if on
	 * view, else the month's first day. From md up, cells show their chips and a
	 * tap opens the new-task flow instead, so this goes unused there.
	 */
	let pickedDay = $state<string | null>(null);
	const selectedDay = $derived(
		pickedDay && grid.some((cell) => cell.iso === pickedDay)
			? pickedDay
			: defaultSelectedDay(grid, todayIso())
	);
	/**
	 * The one day button in the tab order (roving tabindex): the last day focused
	 * while it is on view, else the selected day. Arrow keys move it.
	 */
	let activeDay = $state<string | null>(null);
	const focusDay = $derived(
		activeDay && grid.some((cell) => cell.iso === activeDay) ? activeDay : selectedDay
	);
	let gridElement = $state<HTMLElement>();

	/** Keyboard navigation of the month grid (ARIA date-grid keys). A day outside
	 * the month on view turns the page to its month first. */
	async function gridKeydown(event: KeyboardEvent) {
		const from = (event.target as HTMLElement).dataset.day;
		if (!from) return;
		const target = dayKeyTarget(from, event.key, event.shiftKey);
		if (!target) return;
		event.preventDefault();
		const [year, month] = target.split('-').map(Number);
		if (year !== viewYear || month - 1 !== viewMonth) {
			viewYear = year;
			viewMonth = month - 1;
			pickedDay = null;
		}
		activeDay = target;
		await tick();
		// Each day has a desktop and a phone button; only one is displayed.
		const buttons = gridElement?.querySelectorAll<HTMLElement>(`[data-day="${target}"]`) ?? [];
		[...buttons].find((button) => button.offsetParent !== null)?.focus();
	}

	const selectedTasks = $derived(selectedDay ? (byDay.get(selectedDay) ?? []) : []);

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

	function longDayLabel(iso: string) {
		return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});
	}

	function shortDayLabel(iso: string) {
		return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric'
		});
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
		pickedDay = null;
	}

	function changeYear(delta: 1 | -1) {
		const next = shiftYear(viewYear, viewMonth, delta);
		viewYear = next.year;
		viewMonth = next.month;
		pickedDay = null;
	}

	function goToday() {
		const [year, month] = todayIso().split('-').map(Number);
		viewYear = year;
		viewMonth = month - 1;
		pickedDay = null;
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
	<div class="flex min-w-0 flex-1 items-center md:flex-none md:gap-1">
		<button
			type="button"
			class={NAV_BUTTON}
			aria-label="Previous year"
			title="Previous year"
			onclick={() => changeYear(-1)}
		>
			<Icon name="chevrons-right" size={14} weight={2.2} class="rotate-180" />
		</button>
		<button
			type="button"
			class={NAV_BUTTON}
			aria-label="Previous month"
			title="Previous month"
			onclick={() => changeMonth(-1)}
		>
			<Icon name="chevron-right" size={14} weight={2.2} class="rotate-180" />
		</button>
		<h2 class="min-w-0 flex-1 truncate text-center text-sm font-semibold md:w-40 md:flex-none">
			{heading}
		</h2>
		<button
			type="button"
			class={NAV_BUTTON}
			aria-label="Next month"
			title="Next month"
			onclick={() => changeMonth(1)}
		>
			<Icon name="chevron-right" size={14} weight={2.2} />
		</button>
		<button
			type="button"
			class={NAV_BUTTON}
			aria-label="Next year"
			title="Next year"
			onclick={() => changeYear(1)}
		>
			<Icon name="chevrons-right" size={14} weight={2.2} />
		</button>
	</div>
	<button type="button" class="{button.ghost} h-10 shrink-0 md:h-auto" onclick={goToday}>
		Today
	</button>
</div>

<div class="grid grid-cols-7 gap-y-1 text-center">
	{#each WEEKDAYS as weekday (weekday)}
		<span class="text-2xs font-semibold text-muted">{weekday}</span>
	{/each}
</div>

<p id="calendar-keys-hint" class="sr-only">
	Arrow keys move between days, Home and End to the start or end of the week, Page Up and Page Down
	change the month, with Shift the year.
</p>
<div
	class="grid grid-cols-7 gap-px overflow-hidden rounded-card border border-subtle bg-subtle"
	role="group"
	aria-label={heading}
	aria-describedby="calendar-keys-hint"
	bind:this={gridElement}
>
	{#each grid as cell (cell.iso)}
		{@const dayTasks = byDay.get(cell.iso) ?? []}
		{@const shown = dayTasks.slice(0, CHIPS_SHOWN)}
		{@const extra = dayTasks.length - shown.length}
		{@const dots = dayDots(dayTasks, todayIso())}
		{@const selected = selectedDay === cell.iso}
		<div
			role="group"
			aria-label={longDayLabel(cell.iso)}
			class="relative flex min-h-13 flex-col items-center gap-1 p-1 transition-colors md:min-h-24 md:items-stretch md:p-1.5 {dragOverIso ===
			cell.iso
				? 'bg-accent/5'
				: selected
					? 'bg-accent/10 md:bg-surface'
					: 'bg-surface'}"
			ondragover={(event) => dragOver(event, cell.iso)}
			ondragleave={() => dragLeave(cell.iso)}
			ondrop={(event) => drop(event, cell.iso)}
		>
			<!-- A sibling layer rather than a wrapper: the chips are buttons too, and
			     buttons can't nest. Chips sit above it, so they keep their own clicks. -->
			<button
				type="button"
				class="absolute inset-0 hidden md:block"
				aria-label="{longDayLabel(cell.iso)}, {dayTasks.length} {dayTasks.length === 1
					? 'task'
					: 'tasks'}. New task"
				aria-current={cell.isToday ? 'date' : undefined}
				data-day={cell.iso}
				tabindex={cell.iso === focusDay ? 0 : -1}
				onfocus={() => (activeDay = cell.iso)}
				onkeydown={gridKeydown}
				onclick={() => onCreateTask(cell.iso)}
			></button>
			<!-- Phones: a tap selects the day; its tasks list under the grid. -->
			<button
				type="button"
				class="absolute inset-0 md:hidden"
				aria-label="{longDayLabel(cell.iso)}, {dayTasks.length} {dayTasks.length === 1
					? 'task'
					: 'tasks'}"
				aria-pressed={selected}
				aria-current={cell.isToday ? 'date' : undefined}
				data-day={cell.iso}
				tabindex={cell.iso === focusDay ? 0 : -1}
				onfocus={() => (activeDay = cell.iso)}
				onkeydown={gridKeydown}
				onclick={() => (pickedDay = cell.iso)}
			></button>

			<span
				class="flex size-5.5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold md:self-start {cell.inCurrentMonth
					? 'text-content'
					: 'text-muted'} {cell.isToday ? 'ring-2 ring-accent' : ''}"
			>
				{cell.day}
			</span>

			{#if dots.tones.length > 0}
				<span class="flex items-center gap-0.5 md:hidden" aria-hidden="true">
					{#each dots.tones as tone, index (index)}
						<span class="size-1.5 rounded-full {DOT_CLASSES[tone]}"></span>
					{/each}
					{#if dots.extra > 0}
						<span class="text-[0.5625rem] leading-none font-semibold text-muted">+{dots.extra}</span
						>
					{/if}
				</span>
			{/if}

			<!-- md+: task chips and the "+N more" popup. -->
			<div class="hidden md:contents">
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
		</div>
	{/each}
</div>

{#if selectedDay}
	{@const day = selectedDay}
	<section class="mt-4 md:hidden" aria-label="Tasks on {longDayLabel(day)}">
		<h3 class="mb-2 text-sm font-semibold">{longDayLabel(day)}</h3>
		{#if selectedTasks.length > 0}
			<ul class="mb-2.5 flex flex-col gap-1.5">
				{#each selectedTasks as task (task.id)}
					<li>
						<button
							type="button"
							class="flex min-h-11 w-full items-center gap-2 rounded-control border border-subtle bg-surface px-3 py-2 text-left text-sm transition-colors hover:bg-accent/10 {DUE_CLASSES[
								dueTone(task.dueDate)
							]}"
							onclick={() => onEditTask(task)}
						>
							{#if task.recurrence}
								<Icon
									name="flame"
									size={14}
									class="shrink-0 text-accent-secondary"
									label={RECURRENCE_LABELS[task.recurrence]}
								/>
							{/if}
							<span
								class="min-w-0 flex-1 truncate {!task.recurrence && task.status === 'done'
									? 'text-muted line-through'
									: ''}">{task.title}</span
							>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mb-2.5 text-xs text-muted">Nothing on this day.</p>
		{/if}
		<button type="button" class="{button.ghost} h-10 w-full" onclick={() => onCreateTask(day)}>
			<Icon name="plus" size={14} />
			New task on {shortDayLabel(day)}
		</button>
	</section>
{/if}

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
				class="{button.bare} mp-hit absolute top-2.5 right-2.5"
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
