import { describe, expect, it } from 'vitest';
import type { StreakCard } from '$lib/api';
import { withTodayDone } from './streakToggle';

const card = (over: Partial<StreakCard> = {}): StreakCard =>
	({
		task: { id: 1 },
		current: 2,
		longest: 2,
		doneToday: false,
		cells: [
			{ date: '2026-11-21', state: 'done' },
			{ date: '2026-11-22', state: 'done' },
			{ date: '2026-11-23', state: 'pending' }
		],
		...over
	}) as StreakCard;

describe('withTodayDone', () => {
	it('ticking grows the run, raises best and fills today', () => {
		const next = withTodayDone(card(), true);
		expect(next).toMatchObject({ doneToday: true, current: 3, longest: 3 });
		expect(next.cells[2].state).toBe('done');
	});

	it('unticking shrinks the run and reopens today', () => {
		const next = withTodayDone(card({ doneToday: true, current: 3, longest: 3 }), false);
		expect(next).toMatchObject({ doneToday: false, current: 2, longest: 3 });
		expect(next.cells[2].state).toBe('pending');
	});

	it('never goes below zero and ignores a no-op', () => {
		expect(withTodayDone(card({ doneToday: true, current: 0 }), false).current).toBe(0);
		const same = card();
		expect(withTodayDone(same, false)).toBe(same);
	});
});
