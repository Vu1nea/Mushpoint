import { describe, expect, it } from 'vitest';

import { daysUntil, dueLabel, dueTone, isOverdue, parseDate, percent } from './format';

const NOW = new Date(2026, 6, 31); // 31 July 2026, local time.

describe('percent', () => {
	it('renders a ratio as a whole percent', () => {
		expect(percent(0)).toBe('0%');
		expect(percent(0.75)).toBe('75%');
		expect(percent(1)).toBe('100%');
	});

	it('rounds rather than truncating', () => {
		expect(percent(1 / 3)).toBe('33%');
		expect(percent(2 / 3)).toBe('67%');
	});
});

describe('parseDate', () => {
	it('reads a date-only string in local time', () => {
		const parsed = parseDate('2026-07-31');

		expect(parsed?.getFullYear()).toBe(2026);
		expect(parsed?.getMonth()).toBe(6);
		expect(parsed?.getDate()).toBe(31);
	});

	it('returns null for empty or unparseable input', () => {
		expect(parseDate(null)).toBeNull();
		expect(parseDate('')).toBeNull();
		expect(parseDate('not a date')).toBeNull();
	});
});

describe('daysUntil', () => {
	it('counts calendar days in both directions', () => {
		expect(daysUntil('2026-07-31', NOW)).toBe(0);
		expect(daysUntil('2026-08-03', NOW)).toBe(3);
		expect(daysUntil('2026-07-29', NOW)).toBe(-2);
	});

	it('ignores the time of day', () => {
		expect(daysUntil('2026-07-31T23:30:00Z', new Date(2026, 6, 31, 1))).toBe(0);
	});
});

describe('isOverdue', () => {
	it('is true only after the due date has passed', () => {
		expect(isOverdue('2026-07-30', NOW)).toBe(true);
		expect(isOverdue('2026-07-31', NOW)).toBe(false);
		expect(isOverdue(null, NOW)).toBe(false);
	});
});

describe('dueTone', () => {
	it('escalates as the due date approaches', () => {
		expect(dueTone(null, NOW)).toBe('none');
		expect(dueTone('2026-07-30', NOW)).toBe('overdue');
		expect(dueTone('2026-07-31', NOW)).toBe('soon');
		expect(dueTone('2026-08-05', NOW)).toBe('soon');
		expect(dueTone('2026-08-06', NOW)).toBe('later');
	});
});

describe('dueLabel', () => {
	it('names the near cases', () => {
		expect(dueLabel(null, NOW)).toBe('No due date');
		expect(dueLabel('2026-07-31', NOW)).toBe('Due today');
		expect(dueLabel('2026-08-01', NOW)).toBe('Due tomorrow');
		expect(dueLabel('2026-08-05', NOW)).toBe('Due in 5 days');
	});

	it('counts overdue days, singular and plural', () => {
		expect(dueLabel('2026-07-30', NOW)).toBe('1 day overdue');
		expect(dueLabel('2026-07-25', NOW)).toBe('6 days overdue');
	});

	it('falls back to a date once it is more than a week out', () => {
		expect(dueLabel('2026-09-15', NOW)).toMatch(/^Due /);
		expect(dueLabel('2026-09-15', NOW)).not.toMatch(/days/);
	});
});
