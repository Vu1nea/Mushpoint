import { describe, expect, it } from 'vitest';

import type { TaskSummary } from './api';
import { tasksByDay } from './calendar';

function task(overrides: Partial<TaskSummary> & Pick<TaskSummary, 'id'>): TaskSummary {
	return {
		title: 'Task',
		status: 'todo',
		dueDate: null,
		goalId: null,
		subgoalId: null,
		recurrence: null,
		createdAt: '2026-08-03T12:00:00Z', // a Monday
		updatedAt: '2026-08-03T12:00:00Z',
		completedToday: false,
		expectedToday: true,
		...overrides
	};
}

// Aug 2026: Sat=1, Sun=2, Mon=3, Tue=4, Wed=5, ... Sat=8, Sun=9, Mon=10.
const MON = '2026-08-03';
const TUE = '2026-08-04';
const WED = '2026-08-05';
const SAT = '2026-08-08';
const NEXT_MON = '2026-08-10';
const DAYS = [MON, TUE, WED, SAT, NEXT_MON];

describe('tasksByDay', () => {
	it('gives every input day an empty bucket when there are no tasks', () => {
		const result = tasksByDay([], DAYS);
		expect([...result.keys()]).toEqual(DAYS);
		for (const day of DAYS) expect(result.get(day)).toEqual([]);
	});

	it('places a non-recurring task on its dueDate only', () => {
		const t = task({ id: 1, dueDate: TUE });
		const result = tasksByDay([t], DAYS);

		expect(result.get(TUE)).toEqual([t]);
		expect(result.get(MON)).toEqual([]);
		expect(result.get(WED)).toEqual([]);
	});

	it('leaves a non-recurring task with no dueDate off every day', () => {
		const t = task({ id: 1, dueDate: null });
		const result = tasksByDay([t], DAYS);

		for (const day of DAYS) expect(result.get(day)).toEqual([]);
	});

	it('expands a daily habit onto every day in range', () => {
		const habit = task({ id: 2, recurrence: 'daily', dueDate: null });
		const result = tasksByDay([habit], DAYS);

		for (const day of DAYS) expect(result.get(day)).toEqual([habit]);
	});

	it('expands a weekdays habit onto Mon-Fri only, skipping the weekend', () => {
		const habit = task({ id: 3, recurrence: 'weekdays', dueDate: null });
		const result = tasksByDay([habit], DAYS);

		expect(result.get(MON)).toEqual([habit]);
		expect(result.get(TUE)).toEqual([habit]);
		expect(result.get(WED)).toEqual([habit]);
		expect(result.get(SAT)).toEqual([]);
	});

	it('expands a weekly habit only onto days matching its creation weekday', () => {
		// createdAt above is a Monday, so the anchor weekday is Monday.
		const habit = task({ id: 4, recurrence: 'weekly', dueDate: null });
		const result = tasksByDay([habit], DAYS);

		expect(result.get(MON)).toEqual([habit]);
		expect(result.get(NEXT_MON)).toEqual([habit]);
		expect(result.get(TUE)).toEqual([]);
		expect(result.get(SAT)).toEqual([]);
	});

	it('does not expand a daily habit onto days before it was created', () => {
		const habit = task({ id: 8, recurrence: 'daily', dueDate: null, createdAt: WED + 'T12:00:00Z' });
		const result = tasksByDay([habit], DAYS);

		expect(result.get(MON)).toEqual([]);
		expect(result.get(TUE)).toEqual([]);
		expect(result.get(WED)).toEqual([habit]);
		expect(result.get(SAT)).toEqual([habit]);
		expect(result.get(NEXT_MON)).toEqual([habit]);
	});

	it('dedups a habit that also carries a dueDate landing on an expected day', () => {
		const habit = task({ id: 5, recurrence: 'daily', dueDate: MON });
		const result = tasksByDay([habit], DAYS);

		expect(result.get(MON)).toEqual([habit]);
		expect(result.get(MON)?.length).toBe(1);
	});

	it('preserves input task order within a day bucket', () => {
		const a = task({ id: 6, dueDate: MON });
		const b = task({ id: 7, dueDate: MON });
		const result = tasksByDay([a, b], DAYS);

		expect(result.get(MON)?.map((t) => t.id)).toEqual([6, 7]);
	});
});
