/** Presentation helpers. Pure, so `now` is always passed in rather than read. */

import type { CellState, DayCell } from '$lib/api/types';
import { daysUntil, formatDate } from 'mushpoint-design/utils/format';

export { percent, parseDate, formatDate, daysUntil, isOverdue } from 'mushpoint-design/utils/format';

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
