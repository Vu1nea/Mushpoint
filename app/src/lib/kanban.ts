import { TASK_STATUSES, type TaskStatus, type TaskSummary } from './api';

/**
 * A habit (a task with `recurrence` set) has no lasting `status` — see the rule
 * stated in `app/src/lib/components/TaskRow.svelte:36-38`. Its displayed column is
 * derived from today's completion state instead, so it empties itself at midnight
 * without any scheduled job. Ported from `taskColumn()` in
 * `app/src/routes/tasks/+page.svelte`; keep the two in sync.
 */
export function taskColumn(task: TaskSummary): TaskStatus {
	if (!task.recurrence) return task.status;
	if (!task.expectedToday) return 'done';
	return task.completedToday ? 'done' : 'todo';
}

/** Buckets a flat task list into the three board columns, in input order. */
export function groupByStatus(tasks: TaskSummary[]): Record<TaskStatus, TaskSummary[]> {
	const grouped = Object.fromEntries(
		TASK_STATUSES.map((status) => [status, [] as TaskSummary[]])
	) as Record<TaskStatus, TaskSummary[]>;

	for (const task of tasks) {
		grouped[taskColumn(task)].push(task);
	}

	return grouped;
}
