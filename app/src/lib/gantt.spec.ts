import { describe, expect, it } from 'vitest';

import type { GoalDetail, SubgoalDetail, TaskSummary } from './api';
import { ganttChart } from './gantt';

const TODAY = '2026-08-11';

function subgoal(overrides: Partial<SubgoalDetail> & Pick<SubgoalDetail, 'id'>): SubgoalDetail {
	return {
		goalId: 1,
		title: `Subgoal ${overrides.id}`,
		dueDate: null,
		isComplete: false,
		position: 0,
		createdAt: '2026-08-01T12:00:00Z',
		updatedAt: '2026-08-01T12:00:00Z',
		progress: 0,
		tasks: [],
		...overrides
	};
}

function task(overrides: Partial<TaskSummary> & Pick<TaskSummary, 'id'>): TaskSummary {
	return {
		title: `Task ${overrides.id}`,
		status: 'todo',
		dueDate: null,
		goalId: 1,
		subgoalId: null,
		recurrence: null,
		createdAt: '2026-08-01T12:00:00Z',
		updatedAt: '2026-08-01T12:00:00Z',
		completedToday: false,
		expectedToday: true,
		...overrides
	};
}

function goal(parts: Pick<GoalDetail, 'subgoals' | 'directTasks'>, dueDate: string | null = null) {
	return { ...parts, dueDate };
}

describe('ganttChart', () => {
	it('draws a bar from creation to due date, spanning the whole range', () => {
		const chart = ganttChart(
			goal({ subgoals: [subgoal({ id: 1, dueDate: '2026-08-20' })], directTasks: [] }),
			TODAY
		);

		expect(chart.start).toBe('2026-08-01');
		expect(chart.end).toBe('2026-08-20');
		expect(chart.rows).toHaveLength(1);
		expect(chart.rows[0]).toMatchObject({ title: 'Subgoal 1', left: 0, width: 100 });
	});

	it('places a later bar proportionally inside the range', () => {
		const chart = ganttChart(
			goal({
				subgoals: [subgoal({ id: 1, dueDate: '2026-08-20' })],
				directTasks: [
					task({ id: 2, createdAt: '2026-08-11T12:00:00Z', dueDate: '2026-08-15' })
				]
			}),
			TODAY
		);

		expect(chart.rows[1].left).toBe(50);
		expect(chart.rows[1].width).toBe(25);
	});

	it('marks today inside the range', () => {
		const chart = ganttChart(
			goal({ subgoals: [subgoal({ id: 1, dueDate: '2026-08-20' })], directTasks: [] }),
			TODAY
		);

		expect(chart.todayLeft).toBe(50);
	});

	it('stretches the range to cover today and the goal due date', () => {
		const chart = ganttChart(
			goal({ subgoals: [subgoal({ id: 1, dueDate: '2026-08-05' })], directTasks: [] }, '2026-09-01'),
			TODAY
		);

		expect(chart.end).toBe('2026-09-01');
	});

	it('counts undated items instead of drawing them', () => {
		const chart = ganttChart(
			goal({ subgoals: [subgoal({ id: 1 })], directTasks: [task({ id: 2 })] }),
			TODAY
		);

		expect(chart.rows).toEqual([]);
		expect(chart.undated).toBe(2);
	});

	it('leaves habits out entirely, since they have no end', () => {
		const chart = ganttChart(
			goal({
				subgoals: [],
				directTasks: [task({ id: 1, recurrence: 'daily', dueDate: '2026-08-20' })]
			}),
			TODAY
		);

		expect(chart.rows).toEqual([]);
		expect(chart.undated).toBe(0);
	});

	it('flags unfinished past-due work as overdue, but not finished work', () => {
		const chart = ganttChart(
			goal({
				subgoals: [subgoal({ id: 1, dueDate: '2026-08-05' })],
				directTasks: [task({ id: 2, dueDate: '2026-08-05', status: 'done' })]
			}),
			TODAY
		);

		expect(chart.rows[0]).toMatchObject({ overdue: true, done: false });
		expect(chart.rows[1]).toMatchObject({ overdue: false, done: true });
	});

	it('treats a fully progressed subgoal as done', () => {
		const chart = ganttChart(
			goal({ subgoals: [subgoal({ id: 1, dueDate: '2026-08-05', progress: 1 })], directTasks: [] }),
			TODAY
		);

		expect(chart.rows[0].done).toBe(true);
	});

	it('starts a bar at its due date when that precedes creation', () => {
		const chart = ganttChart(
			goal({ subgoals: [], directTasks: [task({ id: 1, dueDate: '2026-07-20' })] }),
			TODAY
		);

		expect(chart.start).toBe('2026-07-20');
		expect(chart.rows[0].left).toBe(0);
	});
});
