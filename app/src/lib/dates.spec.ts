import { describe, expect, it } from 'vitest';
import { AppError } from './api/error';
import { addDays, compareDates, isExpectedOn, localDateOf, weekdayOf } from './dates';

describe('addDays', () => {
	it('adds and subtracts days across month boundaries', () => {
		expect(addDays('2026-07-30', 1)).toBe('2026-07-31');
		expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
		expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
	});
});

describe('compareDates', () => {
	it('orders chronologically', () => {
		expect(compareDates('2026-07-30', '2026-07-31')).toBeLessThan(0);
		expect(compareDates('2026-07-31', '2026-07-30')).toBeGreaterThan(0);
		expect(compareDates('2026-07-31', '2026-07-31')).toBe(0);
	});
});

describe('weekdayOf', () => {
	it('matches known weekdays', () => {
		// 2026-07-27 is a Monday.
		expect(weekdayOf('2026-07-27')).toBe(1);
		expect(weekdayOf('2026-08-01')).toBe(6); // Saturday
		expect(weekdayOf('2026-08-02')).toBe(0); // Sunday
	});
});

describe('localDateOf', () => {
	it('reads the local calendar day of an RFC 3339 timestamp', () => {
		expect(localDateOf('2026-07-30T23:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('rejects an unreadable timestamp', () => {
		expect(() => localDateOf('not a date')).toThrow(AppError);
	});
});

describe('isExpectedOn', () => {
	it('daily expects every day', () => {
		expect(isExpectedOn('daily', 1, '2026-08-01')).toBe(true);
		expect(isExpectedOn('daily', 1, '2026-08-02')).toBe(true);
	});

	it('weekdays excludes the weekend', () => {
		expect(isExpectedOn('weekdays', 1, '2026-07-31')).toBe(true); // Friday
		expect(isExpectedOn('weekdays', 1, '2026-08-01')).toBe(false); // Saturday
		expect(isExpectedOn('weekdays', 1, '2026-08-02')).toBe(false); // Sunday
	});

	it('weekly only matches its anchor weekday', () => {
		expect(isExpectedOn('weekly', 2, '2026-07-28')).toBe(true); // Tuesday
		expect(isExpectedOn('weekly', 2, '2026-07-29')).toBe(false); // Wednesday
	});
});
