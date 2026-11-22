import { taskColumn } from './kanban';
import type { TaskStatus, TaskSummary } from './api/types';

export type TaskListStatus = 'all' | TaskStatus;

export interface TaskListFilter {
	status: TaskListStatus;
	query: string;
}

/** Tasks matching the status segment and a case-insensitive title query. */
export function filterTasks(
	tasks: TaskSummary[],
	{ status, query }: TaskListFilter
): TaskSummary[] {
	const needle = query.trim().toLowerCase();
	return tasks.filter(
		(task) =>
			(status === 'all' || taskColumn(task) === status) &&
			(needle === '' || task.title.toLowerCase().includes(needle))
	);
}

export function statusCounts(tasks: TaskSummary[]): Record<TaskListStatus, number> {
	const counts: Record<TaskListStatus, number> = {
		all: tasks.length,
		todo: 0,
		in_progress: 0,
		done: 0
	};
	for (const task of tasks) counts[taskColumn(task)] += 1;
	return counts;
}
