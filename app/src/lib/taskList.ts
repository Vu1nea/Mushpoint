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

/**
 * The column a row displays. `tick` is the user's just-made checkbox change
 * (undefined once server data agrees), which overrides until the refresh lands.
 */
export function displayColumn(task: TaskSummary, tick: boolean | undefined): TaskStatus {
	if (tick === undefined) return taskColumn(task);
	if (tick) return 'done';
	if (task.recurrence) return 'todo';
	return task.status === 'done' ? 'todo' : task.status;
}

/**
 * A habit that is not scheduled today: it has nothing to tick, and the board
 * shows its card inert for the same reason.
 */
export function isInertToday(task: TaskSummary): boolean {
	return Boolean(task.recurrence && !task.expectedToday);
}
