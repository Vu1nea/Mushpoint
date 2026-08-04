<!-- app/src/lib/components/DatePicker.svelte -->
<script lang="ts">
	import { backOut } from 'svelte/easing';
	import { fly, scale } from 'svelte/transition';

	import {
		addDays,
		isoOf,
		monthGrid,
		monthLabel,
		shiftMonth,
		todayIso,
		type CalendarDay
	} from '$lib/calendarGrid';
	import { formatDate } from '$lib/format';
	import { motion } from '$lib/motion';
	import { isOutside, Popover, portal } from '$lib/popover.svelte';
	import Icon from './Icon.svelte';
	import { field } from './ui';

	interface Props {
		value: string;
		id?: string;
		ariaLabel?: string;
		placeholder?: string;
		disabled?: boolean;
		/** Use the dashed "optional inline field" style instead of the solid input style. */
		dashed?: boolean;
		class?: string;
	}

	let {
		value = $bindable(),
		id,
		ariaLabel,
		placeholder = 'Pick a date',
		disabled = false,
		dashed = false,
		class: className = ''
	}: Props = $props();

	const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
	// Recomputed on every open (see openPanel) rather than left as a one-time
	// const, so "today" doesn't go stale on a component that stays mounted
	// across midnight.
	let today = $state(todayIso());

	const popover = new Popover();

	let root: HTMLElement | undefined = $state();
	let trigger: HTMLButtonElement | undefined = $state();
	let panel: HTMLElement | undefined = $state();

	let viewYear = $state(0);
	let viewMonth = $state(0);
	// Not derived from `today` (initialized separately, same value) to avoid
	// capturing the $state reference locally — this initial value is only a
	// placeholder anyway, replaced by openPanel() before it's ever shown.
	let activeIso = $state(todayIso());
	let slideDirection = $state(1);

	const grid = $derived(monthGrid(viewYear, viewMonth, value || null, today));
	const heading = $derived(monthLabel(viewYear, viewMonth));

	function baseYearMonth(): { year: number; month: number } {
		const [year, month] = (value || today).split('-').map(Number);
		return { year, month: month - 1 };
	}

	function openPanel() {
		if (disabled || !trigger) return;
		today = todayIso();
		const base = baseYearMonth();
		viewYear = base.year;
		viewMonth = base.month;
		activeIso = value || today;
		popover.show(trigger);
	}

	function closePanel() {
		popover.hide();
	}

	// Pull the panel back on-screen once it's mounted — a trigger near the
	// right edge can otherwise position the fixed-width calendar partly off
	// the viewport.
	$effect(() => {
		if (!popover.open || !panel) return;
		popover.clampHorizontal(panel.getBoundingClientRect().width);
	});

	function pickDay(day: CalendarDay) {
		value = day.iso;
		closePanel();
		trigger?.focus();
	}

	function changeMonth(delta: 1 | -1) {
		slideDirection = delta;
		const next = shiftMonth(viewYear, viewMonth, delta);
		viewYear = next.year;
		viewMonth = next.month;
		// Keep the roving-focus day in the displayed month, same as goToday/pickDay do,
		// so a subsequent arrow-key press moves relative to what's on screen instead of
		// snapping back toward a stale activeIso left over from before the month change.
		// Preserve the day-of-month (clamped to the new month's length) rather than
		// resetting to day 1, so the focus ring doesn't visibly jump on every click.
		const [, , currentDay] = activeIso.split('-').map(Number);
		const daysInNewMonth = new Date(next.year, next.month + 1, 0).getDate();
		activeIso = isoOf(next.year, next.month, Math.min(currentDay, daysInNewMonth));
	}

	function goToday() {
		const [year, month] = today.split('-').map(Number);
		viewYear = year;
		viewMonth = month - 1;
		activeIso = today;
	}

	function clearValue() {
		value = '';
	}

	function moveActive(delta: number) {
		const next = addDays(activeIso, delta);
		const [year, month] = next.split('-').map(Number);
		const monthIndex = month - 1;
		if (year !== viewYear || monthIndex !== viewMonth) {
			const before = viewYear * 12 + viewMonth;
			const after = year * 12 + monthIndex;
			slideDirection = after > before ? 1 : -1;
			viewYear = year;
			viewMonth = monthIndex;
		}
		activeIso = next;
	}

	function onTriggerKeydown(event: KeyboardEvent) {
		if (disabled) return;
		if (!popover.open) {
			if (['ArrowDown', 'Enter', ' '].includes(event.key)) {
				event.preventDefault();
				openPanel();
			}
			return;
		}
		switch (event.key) {
			case 'ArrowLeft':
				event.preventDefault();
				moveActive(-1);
				break;
			case 'ArrowRight':
				event.preventDefault();
				moveActive(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				moveActive(-7);
				break;
			case 'ArrowDown':
				event.preventDefault();
				moveActive(7);
				break;
			case 'Enter':
			case ' ': {
				event.preventDefault();
				const match = grid.find((day) => day.iso === activeIso);
				if (match) pickDay(match);
				break;
			}
			case 'Escape':
				event.preventDefault();
				event.stopPropagation();
				closePanel();
				trigger?.focus();
				break;
		}
	}

	function onTriggerFocusOut(event: FocusEvent) {
		if (!popover.open) return;
		const next = event.relatedTarget as Node | null;
		if (next && (root?.contains(next) || panel?.contains(next))) return;
		closePanel();
	}

	function onWindowMousedown(event: MouseEvent) {
		if (popover.open && isOutside(event, root, panel)) closePanel();
	}

	function onWindowScrollOrResize() {
		if (popover.open) closePanel();
	}
</script>

<svelte:window
	onmousedown={onWindowMousedown}
	onscrollcapture={onWindowScrollOrResize}
	onresize={onWindowScrollOrResize}
/>

<div class="relative {className}" bind:this={root}>
	<button
		bind:this={trigger}
		type="button"
		{disabled}
		aria-haspopup="dialog"
		aria-expanded={popover.open}
		aria-label={ariaLabel}
		{id}
		class="{dashed
			? field.dashed
			: field.input} flex w-full items-center justify-between gap-2 text-left {disabled
			? 'cursor-not-allowed opacity-60'
			: 'cursor-pointer'}"
		onclick={() => {
			if (disabled) return;
			popover.open ? closePanel() : openPanel();
		}}
		onkeydown={onTriggerKeydown}
		onfocusout={onTriggerFocusOut}
	>
		<span class="truncate {value ? '' : 'text-muted'}">
			{value ? formatDate(value) : placeholder}
		</span>
		<Icon name="calendar" size={14} weight={1.8} class="shrink-0 text-muted" />
	</button>
	{#if value}
		<button
			type="button"
			{disabled}
			aria-label="Clear date"
			class="absolute top-1/2 right-8 -translate-y-1/2 rounded-control p-0.5 text-muted transition-colors hover:text-content disabled:pointer-events-none disabled:opacity-60"
			onclick={(event) => {
				event.stopPropagation();
				clearValue();
			}}
		>
			<Icon name="close" size={12} weight={2.2} />
		</button>
	{/if}
</div>

{#if popover.open}
	<div
		use:portal
		bind:this={panel}
		role="dialog"
		aria-label="Choose a date"
		class="fixed z-50 w-70 overflow-hidden rounded-control border border-subtle bg-surface-raised p-3 shadow-[0_16px_40px_rgba(0,0,0,0.3)]"
		style="top: {popover.top}px; left: {popover.left}px;"
		transition:scale={{ start: 0.92, duration: motion(160), easing: backOut }}
	>
		<div class="mb-2 flex items-center justify-between">
			<button
				type="button"
				tabindex="-1"
				class="rounded-control p-1 text-muted transition-colors hover:text-content"
				aria-label="Previous month"
				onclick={() => changeMonth(-1)}
			>
				<Icon name="chevron-right" size={13} weight={2.2} class="rotate-180" />
			</button>
			<span class="text-sm font-semibold">{heading}</span>
			<button
				type="button"
				tabindex="-1"
				class="rounded-control p-1 text-muted transition-colors hover:text-content"
				aria-label="Next month"
				onclick={() => changeMonth(1)}
			>
				<Icon name="chevron-right" size={13} weight={2.2} />
			</button>
		</div>

		<div class="grid grid-cols-7 gap-y-1 text-center">
			{#each WEEKDAYS as weekday (weekday)}
				<span class="text-2xs font-semibold text-muted">{weekday}</span>
			{/each}
		</div>

		{#key `${viewYear}-${viewMonth}`}
			<div
				class="grid grid-cols-7 gap-y-1 text-center"
				in:fly={{ x: slideDirection * 24, duration: motion(180), easing: backOut }}
				out:fly={{ x: slideDirection * -24, duration: motion(120) }}
			>
				{#each grid as day (day.iso)}
					<button
						type="button"
						tabindex="-1"
						class="mx-auto flex size-7.5 items-center justify-center rounded-full text-xs transition-colors
							{day.inCurrentMonth ? 'text-content' : 'text-muted/50'}
							{day.iso === activeIso ? 'ring-2 ring-accent' : ''}
							{day.isSelected ? 'mp-pop bg-accent text-accent-contrast' : 'hover:bg-surface'}
							{day.isToday && !day.isSelected ? 'font-bold text-accent' : ''}"
						onclick={() => pickDay(day)}
					>
						{day.day}
					</button>
				{/each}
			</div>
		{/key}

		<div class="mt-2 flex items-center justify-between border-t border-subtle pt-2">
			<button
				type="button"
				tabindex="-1"
				class="text-xs font-semibold text-accent"
				onclick={goToday}
			>
				Today
			</button>
			{#if value}
				<button
					type="button"
					tabindex="-1"
					class="text-xs font-semibold text-muted transition-colors hover:text-content"
					onclick={() => {
						clearValue();
						closePanel();
					}}
				>
					Clear
				</button>
			{/if}
		</div>
	</div>
{/if}
