import { describe, expect, it } from 'vitest';

import { addDays, isoOf, monthGrid, monthLabel, shiftMonth, todayIso } from './calendarGrid';

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
