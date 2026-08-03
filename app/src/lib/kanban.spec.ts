import { describe, expect, it } from 'vitest';

import type { TaskSummary } from './api';
import { groupByStatus } from './kanban';

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
});
