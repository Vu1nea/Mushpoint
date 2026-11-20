import { describe, expect, it } from 'vitest';

import type { TaskSummary } from './api';
import {
	addDays,
	dayKeyTarget,
	dayDots,
	defaultSelectedDay,
	dotTone,
	isoOf,
	monthGrid,
	monthLabel,
	shiftMonth,
	todayIso
} from './calendarGrid';

describe('isoOf', () => {
	it('formats a zero-padded ISO date from a local year/month/day', () => {
		expect(isoOf(2026, 7, 15)).toBe('2026-08-15');
		expect(isoOf(2026, 0, 1)).toBe('2026-01-01');
	});
});

describe('todayIso', () => {
	it('reads the ISO date from a given Date', () => {
		expect(todayIso(new Date(2026, 6, 31))).toBe('2026-07-31');
	});
});

describe('addDays', () => {
	it('adds and subtracts days within a month', () => {
		expect(addDays('2026-08-15', 1)).toBe('2026-08-16');
		expect(addDays('2026-08-15', -1)).toBe('2026-08-14');
	});

	it('crosses month and year boundaries', () => {
		expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
		expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
	});

	it('adds a full week', () => {
		expect(addDays('2026-08-28', 7)).toBe('2026-09-04');
	});
});

describe('shiftMonth', () => {
	it('moves within a year', () => {
		expect(shiftMonth(2026, 5, 1)).toEqual({ year: 2026, month: 6 });
		expect(shiftMonth(2026, 5, -1)).toEqual({ year: 2026, month: 4 });
	});

	it('wraps across a year boundary', () => {
		expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
		expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
	});
});

describe('monthLabel', () => {
	it('names the month and year', () => {
		expect(monthLabel(2026, 7)).toBe('August 2026');
		expect(monthLabel(2026, 0)).toBe('January 2026');
	});
});

describe('monthGrid', () => {
	it('always returns 42 cells starting on a Sunday', () => {
		const grid = monthGrid(2026, 7, null, '2026-08-15');
		expect(grid).toHaveLength(42);
		expect(new Date(`${grid[0].iso}T00:00:00`).getDay()).toBe(0);
	});

	it('marks exactly one in-month day 1', () => {
		const grid = monthGrid(2026, 7, null, '2026-08-15');
		const firstDays = grid.filter((day) => day.day === 1 && day.inCurrentMonth);
		expect(firstDays).toHaveLength(1);
		expect(firstDays[0].iso).toBe('2026-08-01');
	});

	it('marks the matching today and selected cells', () => {
		const grid = monthGrid(2026, 7, '2026-08-20', '2026-08-15');
		expect(grid.find((day) => day.iso === '2026-08-15')?.isToday).toBe(true);
		expect(grid.find((day) => day.iso === '2026-08-20')?.isSelected).toBe(true);
	});

	it('marks leading/trailing days from neighboring months as out of month', () => {
		const grid = monthGrid(2026, 7, null, '2026-08-15');
		expect(grid[0].inCurrentMonth).toBe(false);
		expect(grid.at(-1)?.inCurrentMonth).toBe(false);
	});
});

function task(overrides: Partial<TaskSummary> & Pick<TaskSummary, 'id'>): TaskSummary {
	return {
		title: 'Task',
		status: 'todo',
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

describe('dotTone', () => {
	const today = '2026-08-15';

	it('marks a habit as a habit whatever its status', () => {
		expect(dotTone(task({ id: 1, recurrence: 'daily', status: 'done' }), today)).toBe('habit');
	});

	it('marks a done one-off task done, even when its date has passed', () => {
		expect(dotTone(task({ id: 1, status: 'done', dueDate: '2026-08-01' }), today)).toBe('done');
	});

	it('marks an unfinished task past its due date overdue', () => {
		expect(dotTone(task({ id: 1, dueDate: '2026-08-14' }), today)).toBe('overdue');
		expect(dotTone(task({ id: 2, dueDate: '2026-08-15' }), today)).toBe('task');
		expect(dotTone(task({ id: 3, status: 'in_progress', dueDate: '2026-09-01' }), today)).toBe(
			'task'
		);
	});
});

describe('dayDots', () => {
	const today = '2026-08-15';

	it('shows one dot per task when there are few', () => {
		expect(dayDots([task({ id: 1 }), task({ id: 2, status: 'done' })], today)).toEqual({
			tones: ['task', 'done'],
			extra: 0
		});
	});

	it('caps at three dots by default and counts the rest', () => {
		const tasks = [1, 2, 3, 4, 5].map((id) => task({ id }));
		expect(dayDots(tasks, today)).toEqual({ tones: ['task', 'task', 'task'], extra: 2 });
	});

	it('takes a custom cap', () => {
		expect(dayDots([task({ id: 1 }), task({ id: 2 })], today, 1).extra).toBe(1);
	});

	it('is empty for a day with no tasks', () => {
		expect(dayDots([], today)).toEqual({ tones: [], extra: 0 });
	});
});

describe('defaultSelectedDay', () => {
	it('picks today when it is in the month on view', () => {
		expect(defaultSelectedDay(monthGrid(2026, 7, null, '2026-08-15'), '2026-08-15')).toBe(
			'2026-08-15'
		);
	});

	it("picks the month's first day when today is elsewhere", () => {
		expect(defaultSelectedDay(monthGrid(2026, 8, null, '2026-08-15'), '2026-08-15')).toBe(
			'2026-09-01'
		);
	});

	it('ignores today when it only shows as a neighboring-month filler day', () => {
		// Sep 2026's grid starts on Sun Aug 30.
		expect(defaultSelectedDay(monthGrid(2026, 8, null, '2026-08-31'), '2026-08-31')).toBe(
			'2026-09-01'
		);
	});

	it('is null for an empty grid', () => {
		expect(defaultSelectedDay([], '2026-08-15')).toBeNull();
	});
});

describe('dayKeyTarget', () => {
	// 2026-07-15 is a Wednesday.
	it('moves by a day or a week with the arrow keys', () => {
		expect(dayKeyTarget('2026-07-15', 'ArrowLeft')).toBe('2026-07-14');
		expect(dayKeyTarget('2026-07-15', 'ArrowRight')).toBe('2026-07-16');
		expect(dayKeyTarget('2026-07-15', 'ArrowUp')).toBe('2026-07-08');
		expect(dayKeyTarget('2026-07-15', 'ArrowDown')).toBe('2026-07-22');
		expect(dayKeyTarget('2026-07-31', 'ArrowRight')).toBe('2026-08-01');
	});

	it('goes to the start or end of the week with Home and End', () => {
		expect(dayKeyTarget('2026-07-15', 'Home')).toBe('2026-07-12');
		expect(dayKeyTarget('2026-07-15', 'End')).toBe('2026-07-18');
	});

	it('moves a month with Page Up/Down and a year with Shift, clamping the day', () => {
		expect(dayKeyTarget('2026-07-15', 'PageUp')).toBe('2026-06-15');
		expect(dayKeyTarget('2026-07-15', 'PageDown')).toBe('2026-08-15');
		expect(dayKeyTarget('2026-03-31', 'PageUp')).toBe('2026-02-28');
		expect(dayKeyTarget('2024-02-29', 'PageDown', true)).toBe('2025-02-28');
		expect(dayKeyTarget('2026-07-15', 'PageUp', true)).toBe('2025-07-15');
	});

	it('ignores other keys', () => {
		expect(dayKeyTarget('2026-07-15', 'Enter')).toBeNull();
		expect(dayKeyTarget('2026-07-15', 'a')).toBeNull();
	});
});
