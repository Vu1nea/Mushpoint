import { describe, expect, it } from 'vitest';

import type { TaskSummary } from './api';
import { filterTasks, groupByStatus, NO_FILTER, pageOf, recentFirst, taskColumn } from './kanban';

function task(overrides: Partial<TaskSummary> & Pick<TaskSummary, 'id' | 'status'>): TaskSummary {
	return {
		title: 'Task',
		dueDate: null,
		goalId: null,
		subgoalId: null,
		recurrence: null,
		createdAt: '2026-08-01T00:00:00Z',
		updatedAt: '2026-08-01T00:00:00Z',
		completedToday: false,
		expectedToday: true,
		...overrides
	};
}

describe('groupByStatus', () => {
	it('buckets tasks by status, preserving input order within a bucket', () => {
		const tasks = [
			task({ id: 1, status: 'todo' }),
			task({ id: 2, status: 'in_progress' }),
			task({ id: 3, status: 'done' }),
			task({ id: 4, status: 'todo' })
		];

		const grouped = groupByStatus(tasks);

		expect(grouped.todo.map((t) => t.id)).toEqual([1, 4]);
		expect(grouped.in_progress.map((t) => t.id)).toEqual([2]);
		expect(grouped.done.map((t) => t.id)).toEqual([3]);
	});

	it('gives every status an empty array when no tasks match', () => {
		const grouped = groupByStatus([]);

		expect(grouped.todo).toEqual([]);
		expect(grouped.in_progress).toEqual([]);
		expect(grouped.done).toEqual([]);
	});

	it('buckets a habit not expected today into done, regardless of raw status', () => {
		const habit = task({
			id: 5,
			status: 'todo',
			recurrence: 'daily',
			expectedToday: false,
			completedToday: false
		});

		const grouped = groupByStatus([habit]);

		expect(grouped.done.map((t) => t.id)).toEqual([5]);
		expect(grouped.todo).toEqual([]);
	});

	it('buckets a habit expected today but not yet completed into todo', () => {
		const habit = task({
			id: 6,
			status: 'done',
			recurrence: 'daily',
			expectedToday: true,
			completedToday: false
		});

		const grouped = groupByStatus([habit]);

		expect(grouped.todo.map((t) => t.id)).toEqual([6]);
		expect(grouped.done).toEqual([]);
	});

	it('buckets a habit expected today and completed into done', () => {
		const habit = task({
			id: 7,
			status: 'todo',
			recurrence: 'daily',
			expectedToday: true,
			completedToday: true
		});

		const grouped = groupByStatus([habit]);

		expect(grouped.done.map((t) => t.id)).toEqual([7]);
		expect(grouped.todo).toEqual([]);
	});
});

describe('filterTasks', () => {
	const now = new Date(2026, 7, 10, 12);
	const ids = (tasks: TaskSummary[]) => tasks.map((t) => t.id);

	it('keeps every task when no filter is set', () => {
		const tasks = [task({ id: 1, status: 'todo' }), task({ id: 2, status: 'done' })];

		expect(ids(filterTasks(tasks, NO_FILTER, now))).toEqual([1, 2]);
	});

	it('matches the title case-insensitively, ignoring surrounding spaces', () => {
		const tasks = [
			task({ id: 1, status: 'todo', title: 'Buy Milk' }),
			task({ id: 2, status: 'todo', title: 'Call bank' })
		];

		expect(ids(filterTasks(tasks, { ...NO_FILTER, query: '  milk ' }, now))).toEqual([1]);
	});

	it('keeps only tasks under the chosen goal', () => {
		const tasks = [
			task({ id: 1, status: 'todo', goalId: 7 }),
			task({ id: 2, status: 'todo', goalId: 8 }),
			task({ id: 3, status: 'todo' })
		];

		expect(ids(filterTasks(tasks, { ...NO_FILTER, goalId: 7 }, now))).toEqual([1]);
	});

	it('keeps only tasks with the chosen due tone', () => {
		const tasks = [
			task({ id: 1, status: 'todo', dueDate: '2026-08-01' }),
			task({ id: 2, status: 'todo', dueDate: '2026-08-11' }),
			task({ id: 3, status: 'todo' })
		];

		expect(ids(filterTasks(tasks, { ...NO_FILTER, due: 'overdue' }, now))).toEqual([1]);
		expect(ids(filterTasks(tasks, { ...NO_FILTER, due: 'none' }, now))).toEqual([3]);
	});

	it('requires every set filter to match', () => {
		const tasks = [
			task({ id: 1, status: 'todo', title: 'Milk', goalId: 7 }),
			task({ id: 2, status: 'todo', title: 'Milk', goalId: 8 })
		];

		expect(ids(filterTasks(tasks, { ...NO_FILTER, query: 'milk', goalId: 8 }, now))).toEqual([2]);
	});
});

describe('pageOf', () => {
	const items = [1, 2, 3, 4, 5, 6, 7];

	it('returns the requested slice with the page count', () => {
		expect(pageOf(items, 1, 3)).toEqual({ items: [4, 5, 6], page: 1, pageCount: 3 });
	});

	it('returns a short final page', () => {
		expect(pageOf(items, 2, 3).items).toEqual([7]);
	});

	it('clamps a page past the end to the last page', () => {
		expect(pageOf(items, 9, 3)).toEqual({ items: [7], page: 2, pageCount: 3 });
	});

	it('gives an empty list one empty page', () => {
		expect(pageOf([], 4, 3)).toEqual({ items: [], page: 0, pageCount: 1 });
	});
});

describe('recentFirst', () => {
	it('orders by updatedAt, newest first, without touching the input', () => {
		const older = task({ id: 1, status: 'done', updatedAt: '2026-08-01T00:00:00Z' });
		const newer = task({ id: 2, status: 'done', updatedAt: '2026-08-05T00:00:00Z' });
		const input = [older, newer];

		expect(recentFirst(input).map((t) => t.id)).toEqual([2, 1]);
		expect(input.map((t) => t.id)).toEqual([1, 2]);
	});
});

describe('taskColumn', () => {
	it('uses task.status directly for a non-recurring task', () => {
		expect(taskColumn(task({ id: 1, status: 'todo' }))).toBe('todo');
		expect(taskColumn(task({ id: 2, status: 'in_progress' }))).toBe('in_progress');
		expect(taskColumn(task({ id: 3, status: 'done' }))).toBe('done');
	});

	it('places a habit not expected today in done', () => {
		const habit = task({
			id: 4,
			status: 'todo',
			recurrence: 'daily',
			expectedToday: false,
			completedToday: false
		});

		expect(taskColumn(habit)).toBe('done');
	});

	it('places an expected, incomplete habit in todo', () => {
		const habit = task({
			id: 5,
			status: 'done',
			recurrence: 'daily',
			expectedToday: true,
			completedToday: false
		});

		expect(taskColumn(habit)).toBe('todo');
	});

	it('places an expected, completed habit in done', () => {
		const habit = task({
			id: 6,
			status: 'todo',
			recurrence: 'daily',
			expectedToday: true,
			completedToday: true
		});

		expect(taskColumn(habit)).toBe('done');
	});
});
