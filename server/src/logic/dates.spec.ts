import { describe, expect, it } from 'vitest';
import { addDays, compareDates, weekdayOf } from './dates';

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
