import type { TaskSummary } from './api';
import { localDateOf } from './db/repo/helpers';
import { weekdayOf } from './db/logic/dates';
import { isExpectedOn } from './db/logic/streak';

/**
 * Buckets tasks onto each day in `days`. A non-recurring task lands on its
 * `dueDate`; a recurring task lands on every day the cadence expects an
 * occurrence, per its creation weekday — same rule the board/streak views
 * already use (`taskColumn` in `./kanban`, `withCompletion` in
 * `./db/repo/task`). A habit that also carries a `dueDate` landing on an
 * expected day is deduped to one entry via the per-task `Set`.
 */
export function tasksByDay(tasks: TaskSummary[], days: string[]): Map<string, TaskSummary[]> {
	const byDay = new Map<string, TaskSummary[]>(days.map((day) => [day, []]));

	for (const task of tasks) {
		const onDays = new Set<string>();
		if (task.dueDate) onDays.add(task.dueDate);

		if (task.recurrence) {
			const anchorWeekday = weekdayOf(localDateOf(task.createdAt));
			for (const day of days) {
				if (isExpectedOn(task.recurrence, anchorWeekday, day)) onDays.add(day);
			}
		}

		for (const day of onDays) {
			byDay.get(day)?.push(task);
		}
	}

	return byDay;
}
