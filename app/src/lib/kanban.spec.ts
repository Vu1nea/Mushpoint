import { describe, expect, it } from 'vitest';

import type { TaskSummary } from './api';
import { groupByStatus, taskColumn } from './kanban';

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
