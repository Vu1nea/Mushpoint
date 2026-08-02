import type { CellState, Recurrence } from '../../api/types';
import { addDays, compareDates, weekdayOf } from './dates';

export interface Streak {
	current: number;
	longest: number;
}

const WEEKEND = new Set([0, 6]); // Sunday, Saturday

/** Every day in `from..=to` that the cadence expects an occurrence on.
 * `anchorWeekday` only matters for `weekly`; the other cadences ignore it. */
export function expectedDays(
	rec: Recurrence,
	anchorWeekday: number,
	from: string,
	to: string
): string[] {
	const days: string[] = [];
	let day = from;

	while (compareDates(day, to) <= 0) {
		const expected =
			rec === 'daily'
				? true
				: rec === 'weekdays'
					? !WEEKEND.has(weekdayOf(day))
					: weekdayOf(day) === anchorWeekday;
		if (expected) days.push(day);
		day = addDays(day, 1);
	}

	return days;
}

/** An occurrence is satisfied by a completion on its own day or up to `grace`
 * days later. Until that window closes it is pending rather than missed, so an
 * untouched task today never zeroes yesterday's streak. */
export function stateOf(day: string, done: Set<string>, grace: number, today: string): CellState {
	let satisfied = false;
	for (let offset = 0; offset <= grace; offset += 1) {
		if (done.has(addDays(day, offset))) {
			satisfied = true;
			break;
		}
	}

	if (satisfied) return 'done';
	if (compareDates(addDays(day, grace), today) >= 0) return 'pending';
	return 'missed';
}

/** `current` walks back from the newest occurrence, skipping ones whose window
 * is still open. `longest` is the best run anywhere in the history. */
export function summarize(
	expected: string[],
	done: Set<string>,
	grace: number,
	today: string
): Streak {
	const states = expected.map((day) => stateOf(day, done, grace, today));

	let longest = 0;
	let run = 0;
	for (const state of states) {
		if (state === 'done') {
			run += 1;
			longest = Math.max(longest, run);
		} else if (state === 'missed') {
			run = 0;
		}
		// A still-open window neither extends nor breaks a run.
	}

	let current = 0;
	for (let i = states.length - 1; i >= 0; i -= 1) {
		const state = states[i];
		if (state === 'pending') continue;
		if (state === 'done') {
			current += 1;
		} else {
			break;
		}
	}

	return { current, longest };
}
