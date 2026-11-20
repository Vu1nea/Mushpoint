import { describe, expect, it } from 'vitest';

import {
	cellTitle,
	heatmapSummary,
	daysUntil,
	dueLabel,
	dueTone,
	isOverdue,
	parseDate,
	percent,
	safeHref,
	weeklyAnchorLabel
} from './format';

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

describe('cellTitle', () => {
	const now = new Date(2026, 6, 31);

	it('names the state of a day', () => {
		expect(cellTitle({ date: '2026-07-30', state: 'done' }, now)).toBe('Jul 30 · done');
		expect(cellTitle({ date: '2026-07-28', state: 'missed' }, now)).toBe('Jul 28 · missed');
		expect(cellTitle({ date: '2026-07-31', state: 'pending' }, now)).toBe('Jul 31 · not yet');
	});

	it('says a day was never expected', () => {
		expect(cellTitle({ date: '2026-07-25', state: 'not_expected' }, now)).toBe(
			'Jul 25 · not scheduled'
		);
	});
});

describe('heatmapSummary', () => {
	it('counts each state and says how today stands', () => {
		const cells = [
			{ date: '2026-07-27', state: 'done' },
			{ date: '2026-07-28', state: 'missed' },
			{ date: '2026-07-29', state: 'not_expected' },
			{ date: '2026-07-30', state: 'done' },
			{ date: '2026-07-31', state: 'pending' }
		] as const;
		expect(heatmapSummary([...cells])).toBe(
			'Last 5 days: 2 done, 1 missed, 1 not scheduled. Today: not yet.'
		);
	});

	it('leaves out states that never occur', () => {
		expect(heatmapSummary([{ date: '2026-07-31', state: 'done' }])).toBe(
			'Last 1 day: 1 done. Today: done.'
		);
	});

	it('handles an empty history', () => {
		expect(heatmapSummary([])).toBe('No history yet.');
	});
});

describe('weeklyAnchorLabel', () => {
	it('names the weekday a habit was created on', () => {
		// 2026-07-28T09:00:00Z is a Tuesday.
		expect(weeklyAnchorLabel('2026-07-28T09:00:00Z')).toBe('Tuesdays');
	});

	it('is blank when the timestamp cannot be read', () => {
		expect(weeklyAnchorLabel('not a date')).toBe('');
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

describe('safeHref', () => {
	it('passes http and https URLs through', () => {
		expect(safeHref('https://github.com/acme/widget')).toBe('https://github.com/acme/widget');
		expect(safeHref('http://example.com')).toBe('http://example.com');
	});

	it.each([
		null,
		'',
		'javascript:alert(1)',
		' JavaScript:alert(1)',
		'data:text/html,x',
		'not a url'
	])('refuses %s', (raw) => {
		expect(safeHref(raw)).toBeNull();
	});
});
