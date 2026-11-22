import type { TaskSummary } from './api';
import { compareDates } from './dates';

export * from 'mushpoint-design/utils/calendarGrid';

/** What a compact (phone) calendar dot says about one task on one day. */
export type DotTone = 'habit' | 'done' | 'overdue' | 'task';

/** Most dots a compact day cell shows before collapsing the rest into "+n". */
export const DOTS_SHOWN = 3;

/**
 * A task's dot color on `day`. A habit is always its own tone (its done state is
 * per day, and only today's is known). A one-off task is done, overdue (its due
 * date has passed and it isn't done), or plain.
 */
export function dotTone(task: TaskSummary, today: string): DotTone {
	if (task.recurrence) return 'habit';
	if (task.status === 'done') return 'done';
	if (task.dueDate && compareDates(task.dueDate, today) < 0) return 'overdue';
	return 'task';
}

/** The first `max` dots for a day's tasks (in list order) and how many are left over. */
export function dayDots(
	tasks: TaskSummary[],
	today: string,
	max: number = DOTS_SHOWN
): { tones: DotTone[]; extra: number } {
	const shown = tasks.slice(0, Math.max(0, max));
	return { tones: shown.map((task) => dotTone(task, today)), extra: tasks.length - shown.length };
}

/**
 * The day a phone calendar selects when the reader hasn't picked one: today
 * when it falls in the month on view, otherwise that month's first day.
 */
export function defaultSelectedDay(
	cells: { iso: string; inCurrentMonth: boolean }[],
	today: string
): string | null {
	const inMonth = cells.filter((cell) => cell.inCurrentMonth);
	return (inMonth.find((cell) => cell.iso === today) ?? inMonth[0])?.iso ?? null;
}
