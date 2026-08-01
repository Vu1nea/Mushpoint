/** Presentation helpers. Pure, so `now` is always passed in rather than read. */

import type { CellState, DayCell } from '$lib/api/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Progress arrives as a 0–1 ratio; screens show whole percents. */
export function percent(ratio: number): string {
	return `${Math.round(ratio * 100)}%`;
}

/** Midnight-anchored copy of a date, so comparisons are by calendar day. */
function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseDate(value: string | null | undefined): Date | null {
	if (!value) return null;
	// `YYYY-MM-DD` parses as UTC midnight, which lands on the previous day in
	// western timezones — split it out and build a local date instead.
	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	const parsed = dateOnly
		? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
		: new Date(value);

	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Whole days from `now` to `due`: negative when the due date has passed. */
export function daysUntil(due: string | null, now: Date = new Date()): number | null {
	const date = parseDate(due);
	if (!date) return null;
	return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

export function isOverdue(due: string | null, now: Date = new Date()): boolean {
	const days = daysUntil(due, now);
	return days !== null && days < 0;
}

export function formatDate(value: string | null, now: Date = new Date()): string {
	const date = parseDate(value);
	if (!date) return '';

	const sameYear = date.getFullYear() === now.getFullYear();
	return date.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		...(sameYear ? {} : { year: 'numeric' })
	});
}

/**
 * How loudly a due date should read. The design colors overdue dates with the
 * alarm color, anything inside five days with the tertiary accent, and the rest
 * like ordinary muted text.
 */
export type DueTone = 'none' | 'overdue' | 'soon' | 'later';

export function dueTone(due: string | null, now: Date = new Date()): DueTone {
	const days = daysUntil(due, now);
	if (days === null) return 'none';
	if (days < 0) return 'overdue';
	return days <= 5 ? 'soon' : 'later';
}

const CELL_WORDS: Record<CellState, string> = {
	done: 'done',
	missed: 'missed',
	pending: 'not yet',
	not_expected: 'not scheduled'
};

/** Hover text for one heatmap square: "Jul 30 · done". */
export function cellTitle(cell: DayCell, now: Date = new Date()): string {
	return `${formatDate(cell.date, now)} · ${CELL_WORDS[cell.state]}`;
}

/**
 * Which weekday a weekly habit lands on. The backend anchors weekly recurrence
 * to the task's creation weekday, so this reads the same value back for display.
 */
export function weeklyAnchorLabel(createdAt: string): string {
	const created = new Date(createdAt);
	if (Number.isNaN(created.getTime())) return '';

	return `${created.toLocaleDateString(undefined, { weekday: 'long' })}s`;
}

/** Human due-date line used on goal, subgoal and task rows. */
export function dueLabel(due: string | null, now: Date = new Date()): string {
	const days = daysUntil(due, now);
	if (days === null) return 'No due date';

	if (days === 0) return 'Due today';
	if (days === 1) return 'Due tomorrow';
	if (days === -1) return '1 day overdue';
	if (days < 0) return `${Math.abs(days)} days overdue`;
	if (days <= 7) return `Due in ${days} days`;
	return `Due ${formatDate(due, now)}`;
}
