// Edge cases for streaks: daylight-saving changes, users crossing time zones,
// and the exact edges of the grace window. Days are `YYYY-MM-DD` strings in the
// user's zone; only `localDateOf`/`today` ever touch an instant.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { localDateOf, today } from '../repo/helpers';
import { addDays, weekdayOf } from './dates';
import { expectedDays, stateOf, summarize } from './streak';

afterEach(() => {
	vi.useRealTimers();
});

// 2026 transitions: US spring forward Sun 8 Mar, fall back Sun 1 Nov;
// EU spring forward Sun 29 Mar, fall back Sun 25 Oct.
describe('daylight-saving transitions', () => {
	it.each([
		['2026-03-07', '2026-03-08', '2026-03-09'],
		['2026-10-31', '2026-11-01', '2026-11-02'],
		['2026-03-28', '2026-03-29', '2026-03-30'],
		['2026-10-24', '2026-10-25', '2026-10-26']
	])('addDays steps exactly one day over %s -> %s -> %s', (before, day, after) => {
		expect(addDays(before, 1)).toBe(day);
		expect(addDays(day, 1)).toBe(after);
		expect(addDays(after, -2)).toBe(before);
	});

	it('the transition day is still a Sunday', () => {
		expect(weekdayOf('2026-03-08')).toBe(0);
		expect(weekdayOf('2026-11-01')).toBe(0);
	});

	it('a daily habit expects each day once across a transition, no gaps or repeats', () => {
		expect(expectedDays('daily', 0, '2026-10-31', '2026-11-02')).toEqual([
			'2026-10-31',
			'2026-11-01',
			'2026-11-02'
		]);
		expect(expectedDays('daily', 0, '2026-03-07', '2026-03-09')).toEqual([
			'2026-03-07',
			'2026-03-08',
			'2026-03-09'
		]);
	});

	it('a weekly Sunday habit lands on both transition Sundays', () => {
		expect(expectedDays('weekly', 0, '2026-10-25', '2026-11-08')).toEqual([
			'2026-10-25',
			'2026-11-01',
			'2026-11-08'
		]);
	});

	it('the repeated hour on fall-back day stays on that day', () => {
		// New York: 01:30 EDT (05:30Z) and 01:30 EST (06:30Z) are both 1 Nov.
		expect(localDateOf('2026-11-01T05:30:00.000Z', 'America/New_York')).toBe('2026-11-01');
		expect(localDateOf('2026-11-01T06:30:00.000Z', 'America/New_York')).toBe('2026-11-01');
		// 23:30 EST on 1 Nov is 04:30Z on 2 Nov.
		expect(localDateOf('2026-11-02T04:30:00.000Z', 'America/New_York')).toBe('2026-11-01');
	});

	it('the skipped hour on spring-forward day stays on that day', () => {
		// 01:59 EST is 06:59Z; one minute later it is 03:00 EDT (07:00Z).
		expect(localDateOf('2026-03-08T06:59:00.000Z', 'America/New_York')).toBe('2026-03-08');
		expect(localDateOf('2026-03-08T07:00:00.000Z', 'America/New_York')).toBe('2026-03-08');
		// Midnight-adjacent instants either side of the 23-hour day.
		expect(localDateOf('2026-03-08T04:59:00.000Z', 'America/New_York')).toBe('2026-03-07');
		expect(localDateOf('2026-03-09T03:59:00.000Z', 'America/New_York')).toBe('2026-03-08');
		expect(localDateOf('2026-03-09T04:00:00.000Z', 'America/New_York')).toBe('2026-03-09');
	});

	it('today flips at local midnight, not UTC midnight, after the clocks change', () => {
		vi.useFakeTimers();
		// London is on BST (UTC+1) after 29 Mar: 23:30Z on the 30th is already the 31st.
		vi.setSystemTime(new Date('2026-03-30T23:30:00Z'));
		expect(today('Europe/London')).toBe('2026-03-31');
		// Before the change it is GMT: the same wall-clock UTC time is still the same day.
		vi.setSystemTime(new Date('2026-03-27T23:30:00Z'));
		expect(today('Europe/London')).toBe('2026-03-27');
	});
});

describe('time zone changes', () => {
	it('one instant can be two calendar days apart across zones', () => {
		const instant = '2026-06-15T10:30:00.000Z';
		expect(localDateOf(instant, 'Pacific/Kiritimati')).toBe('2026-06-16'); // UTC+14
		expect(localDateOf(instant, 'Pacific/Pago_Pago')).toBe('2026-06-14'); // UTC-11
	});

	it('flying west: a completion dated "tomorrow" does not break or extend the streak', () => {
		// Ticked just after midnight in Tokyo (the 16th), now in Los Angeles where
		// it is still the 15th. Grace 0: the 16th is not expected yet, and today
		// (the 15th) is still pending, so the run up to the 14th stands.
		const done = new Set(['2026-06-13', '2026-06-14', '2026-06-16']);
		const todayLa = '2026-06-15';
		const expected = expectedDays('daily', 0, '2026-06-13', todayLa);
		expect(stateOf(todayLa, done, 0, todayLa)).toBe('pending');
		expect(summarize(expected, done, 0, todayLa)).toEqual({ current: 2, longest: 2 });
	});

	it('flying west with grace: that completion covers today', () => {
		const done = new Set(['2026-06-14', '2026-06-16']);
		const todayLa = '2026-06-15';
		expect(stateOf(todayLa, done, 1, todayLa)).toBe('done');
	});

	it('flying east: a skipped calendar day is missed once its window closes', () => {
		// Left LA on the 14th, landed in Tokyo on the 16th: the 15th never happened
		// locally for the user, but it is still an expected day.
		const done = new Set(['2026-06-13', '2026-06-14', '2026-06-16']);
		const expected = expectedDays('daily', 0, '2026-06-13', '2026-06-16');
		expect(summarize(expected, done, 0, '2026-06-16')).toEqual({ current: 1, longest: 2 });
		// One grace day lets the 16th's completion cover the 15th.
		expect(summarize(expected, done, 1, '2026-06-16')).toEqual({ current: 4, longest: 4 });
	});
});

describe('grace-period boundaries', () => {
	const day = '2026-07-28';

	it.each([0, 1, 2, 3])('grace %i: a completion on the last day of the window counts', (grace) => {
		const lastDay = addDays(day, grace);
		const today = addDays(day, grace + 5);
		expect(stateOf(day, new Set([lastDay]), grace, today)).toBe('done');
	});

	it.each([0, 1, 2, 3])('grace %i: a completion one day after the window does not', (grace) => {
		const late = addDays(day, grace + 1);
		const today = addDays(day, grace + 5);
		expect(stateOf(day, new Set([late]), grace, today)).toBe('missed');
	});

	it.each([0, 1, 2, 3])(
		'grace %i: pending while the window ends today, missed the day after',
		(grace) => {
			const windowEnd = addDays(day, grace);
			expect(stateOf(day, new Set(), grace, windowEnd)).toBe('pending');
			expect(stateOf(day, new Set(), grace, addDays(windowEnd, 1))).toBe('missed');
		}
	);

	it('a completion before the occurrence does not count for it', () => {
		expect(stateOf(day, new Set([addDays(day, -1)]), 2, addDays(day, 10))).toBe('missed');
	});

	it('the window runs across a month and a year end', () => {
		expect(stateOf('2026-01-31', new Set(['2026-02-02']), 2, '2026-02-10')).toBe('done');
		expect(stateOf('2026-12-31', new Set(['2027-01-01']), 1, '2027-01-10')).toBe('done');
		expect(stateOf('2026-12-31', new Set(['2027-01-02']), 1, '2027-01-10')).toBe('missed');
	});

	it('the window runs across 29 February in a leap year', () => {
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
		expect(stateOf('2028-02-28', new Set(['2028-03-01']), 2, '2028-03-10')).toBe('done');
		// 2026 has no 29th: the same two-day grace reaches 2 March.
		expect(stateOf('2026-02-28', new Set(['2026-03-02']), 2, '2026-03-10')).toBe('done');
	});

	it('one completion can satisfy several occurrences inside their windows', () => {
		// Grace 2, daily, one tick on the 30th: the 28th, 29th and 30th all count.
		const expected = expectedDays('daily', 0, '2026-07-28', '2026-07-30');
		expect(summarize(expected, new Set(['2026-07-30']), 2, '2026-07-30')).toEqual({
			current: 3,
			longest: 3
		});
	});

	it('weekdays: Friday with one grace day can be ticked on Saturday', () => {
		// 2026-07-31 is a Friday.
		expect(weekdayOf('2026-07-31')).toBe(5);
		expect(stateOf('2026-07-31', new Set(['2026-08-01']), 1, '2026-08-05')).toBe('done');
		// The weekend is never expected, so Monday's streak picks up from Friday.
		const expected = expectedDays('weekdays', 0, '2026-07-30', '2026-08-03');
		expect(expected).toEqual(['2026-07-30', '2026-07-31', '2026-08-03']);
		const done = new Set(['2026-07-30', '2026-07-31', '2026-08-03']);
		expect(summarize(expected, done, 0, '2026-08-03')).toEqual({ current: 3, longest: 3 });
	});
});
