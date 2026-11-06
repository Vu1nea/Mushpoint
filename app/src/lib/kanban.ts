import { TASK_STATUSES, type TaskStatus, type TaskSummary } from './api';
import { dueTone } from './format';

/** Cards per column page — short enough to take a column in at a glance. */
export const PAGE_SIZE = 5;

export type DueFilter = ReturnType<typeof dueTone> | 'all';

export interface TaskFilter {
	query: string;
	goalId: number | null;
	due: DueFilter;
}

export const NO_FILTER: TaskFilter = { query: '', goalId: null, due: 'all' };

/** Keeps the tasks matching every set filter, in input order. */
export function filterTasks(
	tasks: TaskSummary[],
	{ query, goalId, due }: TaskFilter,
	now: Date = new Date()
): TaskSummary[] {
	const needle = query.trim().toLowerCase();
	return tasks.filter(
		(task) =>
			task.title.toLowerCase().includes(needle) &&
			(goalId === null || task.goalId === goalId) &&
			(due === 'all' || dueTone(task.dueDate, now) === due)
	);
}

/** One page of `items`. `page` is zero-based and clamped, so a list that shrank
 * under the reader lands on its last page rather than an empty one. */
export function pageOf<T>(items: T[], page: number, size: number) {
	const pageCount = Math.max(1, Math.ceil(items.length / size));
	const clamped = Math.min(Math.max(page, 0), pageCount - 1);
	return {
		items: items.slice(clamped * size, (clamped + 1) * size),
		page: clamped,
		pageCount
	};
}

/** Newest change first — the Done column's first page is what was just finished. */
export function recentFirst(tasks: TaskSummary[]): TaskSummary[] {
	return [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * A habit (a task with `recurrence` set) has no lasting `status` — see the rule
 * stated in `app/src/lib/components/TaskRow.svelte:36-38`. Its displayed column is
 * derived from today's completion state instead, so it empties itself at midnight
 * without any scheduled job. Used directly by `KanbanBoard.svelte` for both the
 * goal-detail and Task Manager boards — no separate copy to keep in sync.
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
