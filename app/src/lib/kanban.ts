import { TASK_STATUSES, type TaskStatus, type TaskSummary } from './api';

/** Buckets a flat task list into the three board columns, in input order. */
export function groupByStatus(tasks: TaskSummary[]): Record<TaskStatus, TaskSummary[]> {
	const grouped = Object.fromEntries(
		TASK_STATUSES.map((status) => [status, [] as TaskSummary[]])
	) as Record<TaskStatus, TaskSummary[]>;

	for (const task of tasks) {
		grouped[task.status].push(task);
	}

	return grouped;
}
