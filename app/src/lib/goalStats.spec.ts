import { describe, expect, it } from 'vitest';
import type { TaskStatus, TaskSummary } from './api/types';
import { goalStats } from './goalStats';

function task(
	id: number,
	status: TaskStatus = 'todo',
	over: Partial<TaskSummary> = {}
): TaskSummary {
	return {
		id,
		title: `t${id}`,
		status,
		dueDate: null,
		goalId: 1,
		subgoalId: null,
		recurrence: null,
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z',
		completedToday: false,
		expectedToday: true,
		...over
	};
}

describe('goalStats', () => {
	it('is all zero for an empty goal', () => {
		expect(goalStats({ progress: 0 }, [], [])).toEqual({
			progressPct: 0,
			subgoalsDone: 0,
			subgoalsTotal: 0,
			tasksDone: 0,
			tasksTotal: 0
		});
	});

	it('counts everything done', () => {
		const stats = goalStats({ progress: 1 }, [{ progress: 1 }, { progress: 1 }], [task(1, 'done')]);
		expect(stats).toMatchObject({
			progressPct: 100,
			subgoalsDone: 2,
			subgoalsTotal: 2,
			tasksDone: 1,
			tasksTotal: 1
		});
	});

	it('counts a partial goal and rounds the percentage', () => {
		const stats = goalStats(
			{ progress: 0.3349 },
			[{ progress: 1 }, { progress: 0.5 }, { progress: 0 }],
			[task(1, 'done'), task(2, 'in_progress'), task(3)]
		);
		expect(stats).toEqual({
			progressPct: 33,
			subgoalsDone: 1,
			subgoalsTotal: 3,
			tasksDone: 1,
			tasksTotal: 3
		});
	});

	it('rounds half up', () => {
		expect(goalStats({ progress: 0.675 }, [], []).progressPct).toBe(68);
	});

	it('counts a habit as done by its board column, not its status', () => {
		const doneToday = task(1, 'todo', { recurrence: 'daily', completedToday: true });
		const notToday = task(2, 'todo', { recurrence: 'weekly', expectedToday: false });
		const pending = task(3, 'todo', { recurrence: 'daily' });
		expect(goalStats({ progress: 0 }, [], [doneToday, notToday, pending]).tasksDone).toBe(2);
	});
});
