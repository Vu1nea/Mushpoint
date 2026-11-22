import { describe, expect, it } from 'vitest';
import type { TaskStatus, TaskSummary } from './api/types';
import { filterTasks, statusCounts } from './taskList';

function task(id: number, title: string, status: TaskStatus = 'todo'): TaskSummary {
	return {
		id,
		title,
		status,
		dueDate: null,
		goalId: null,
		subgoalId: null,
		recurrence: null,
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z',
		completedToday: false,
		expectedToday: true
	};
}

const tasks = [
	task(1, 'Write report'),
	task(2, 'Buy milk', 'in_progress'),
	task(3, 'Review REPORT draft', 'done'),
	task(4, 'x'.repeat(200), 'done')
];

describe('filterTasks', () => {
	it('returns everything for status all and an empty query', () => {
		expect(filterTasks(tasks, { status: 'all', query: '' })).toEqual(tasks);
	});

	it('treats a whitespace-only query as empty', () => {
		expect(filterTasks(tasks, { status: 'all', query: '   ' })).toEqual(tasks);
	});

	it('matches the title case-insensitively', () => {
		const ids = filterTasks(tasks, { status: 'all', query: ' rePort ' }).map((t) => t.id);
		expect(ids).toEqual([1, 3]);
	});

	it('filters by status', () => {
		const ids = filterTasks(tasks, { status: 'done', query: '' }).map((t) => t.id);
		expect(ids).toEqual([3, 4]);
	});

	it('combines status and query', () => {
		const ids = filterTasks(tasks, { status: 'done', query: 'report' }).map((t) => t.id);
		expect(ids).toEqual([3]);
	});

	it('handles a 200-character title', () => {
		expect(filterTasks(tasks, { status: 'all', query: 'xxx' }).map((t) => t.id)).toEqual([4]);
	});

	it('returns an empty array when nothing matches', () => {
		expect(filterTasks(tasks, { status: 'all', query: 'zzz' })).toEqual([]);
	});
});

describe('statusCounts', () => {
	it('counts per status and in total', () => {
		expect(statusCounts(tasks)).toEqual({ all: 4, todo: 1, in_progress: 1, done: 2 });
	});

	it('per-status counts sum to all', () => {
		const c = statusCounts(tasks);
		expect(c.todo + c.in_progress + c.done).toBe(c.all);
	});

	it('is all zero for no tasks', () => {
		expect(statusCounts([])).toEqual({ all: 0, todo: 0, in_progress: 0, done: 0 });
	});
});
