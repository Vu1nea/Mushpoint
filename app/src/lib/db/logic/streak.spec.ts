import { describe, expect, it } from 'vitest';
import { expectedDays, stateOf, summarize } from './streak';

describe('expectedDays', () => {
	it('daily expects every day in the range', () => {
		const days = expectedDays('daily', 1, '2026-07-27', '2026-07-30');
		expect(days).toHaveLength(4);
		expect(days[0]).toBe('2026-07-27');
		expect(days[3]).toBe('2026-07-30');
	});

	it('weekdays skips the weekend', () => {
		const days = expectedDays('weekdays', 1, '2026-07-27', '2026-08-02');
		expect(days).toHaveLength(5);
		expect(days.at(-1)).toBe('2026-07-31');
	});

	it('weekly expects only its anchor weekday', () => {
		// Tuesday = 2.
		const days = expectedDays('weekly', 2, '2026-07-27', '2026-08-11');
		expect(days).toEqual(['2026-07-28', '2026-08-04', '2026-08-11']);
	});
});

describe('stateOf', () => {
	it('an occurrence completed within grace still counts', () => {
		const log = new Set(['2026-07-30']);
		const today = '2026-07-31';
		// Grace 2: the 28th's window is [28, 30], covered by the completion on the 30th.
		expect(stateOf('2026-07-28', log, 2, today)).toBe('done');
		// Grace 1: window is [28, 29], closed before the completion landed.
		expect(stateOf('2026-07-28', log, 1, today)).toBe('missed');
	});

	it('an open window is pending, not missed', () => {
		const log = new Set<string>();
		const today = '2026-07-31';
		expect(stateOf(today, log, 2, today)).toBe('pending');
		expect(stateOf('2026-07-29', log, 2, today)).toBe('pending');
		expect(stateOf('2026-07-28', log, 2, today)).toBe('missed');
	});

	it('grace zero demands the exact day', () => {
		const log = new Set(['2026-07-30']);
		const today = '2026-07-31';
		expect(stateOf('2026-07-30', log, 0, today)).toBe('done');
		expect(stateOf('2026-07-29', log, 0, today)).toBe('missed');
	});
});

describe('summarize', () => {
	it('a pending day does not end the current streak', () => {
		const today = '2026-07-31';
		const expected = expectedDays('daily', 1, '2026-07-28', today);
		const log = new Set(['2026-07-28', '2026-07-29', '2026-07-30']);
		const streak = summarize(expected, log, 0, today);
		expect(streak.current).toBe(3);
		expect(streak.longest).toBe(3);
	});

	it('a closed miss resets current but not longest', () => {
		const today = '2026-07-31';
		const expected = expectedDays('daily', 1, '2026-07-20', today);
		const log = new Set([
			'2026-07-20',
			'2026-07-21',
			'2026-07-22',
			'2026-07-23',
			'2026-07-29',
			'2026-07-30'
		]);
		const streak = summarize(expected, log, 0, today);
		expect(streak.current).toBe(2);
		expect(streak.longest).toBe(4);
	});

	it('an empty history has no streak', () => {
		const streak = summarize([], new Set(), 2, '2026-07-31');
		expect(streak).toEqual({ current: 0, longest: 0 });
	});

	it('a weekly habit counts weeks, not days', () => {
		const today = '2026-08-11';
		const expected = expectedDays('weekly', 2, '2026-07-28', today);
		const log = new Set(['2026-07-28', '2026-08-04']);
		const streak = summarize(expected, log, 2, today);
		expect(streak.current).toBe(2);
		expect(streak.longest).toBe(2);
	});
});
