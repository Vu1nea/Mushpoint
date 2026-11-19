import type { TaskSummary } from './api';
import { compareDates, isExpectedOn, localDateOf, weekdayOf } from './dates';

/**
 * Buckets tasks onto each day in `days`. A non-recurring task lands on its
 * `dueDate`; a recurring task lands on every day the cadence expects an
 * occurrence, per its creation weekday — same rule the board/streak views
 * already use (`taskColumn` in `./kanban`, `withCompletion` in
 * the server's `repo/task`). A habit that also carries a `dueDate` landing on an
 * expected day is deduped to one entry via the per-task `Set`.
 */
export function tasksByDay(tasks: TaskSummary[], days: string[]): Map<string, TaskSummary[]> {
	const byDay = new Map<string, TaskSummary[]>(days.map((day) => [day, []]));

	for (const task of tasks) {
		const onDays = new Set<string>();
		if (task.dueDate) onDays.add(task.dueDate);

		if (task.recurrence) {
			const created = localDateOf(task.createdAt);
			const anchorWeekday = weekdayOf(created);
			for (const day of days) {
				if (compareDates(day, created) >= 0 && isExpectedOn(task.recurrence, anchorWeekday, day)) {
					onDays.add(day);
				}
			}
		}

		for (const day of onDays) {
			byDay.get(day)?.push(task);
		}
	}

	return byDay;
}

/**
 * Steps a month view by whole years, keeping the month (0-based). The view
 * holds no day, so there is nothing to clamp.
 */
export function shiftYear(
	year: number,
	month: number,
	delta: number
): { year: number; month: number } {
	return { year: year + delta, month };
}
