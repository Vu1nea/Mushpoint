import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { CellState, DayCell, StreakCard, Task } from '../../api/types';
import { localDateOf, parseDateOrThrow, today as todayFn } from './helpers';
import * as task from './task';
import * as settings from './settings';
import * as completion from './completion';
import { expectedDays, stateOf, summarize } from '../logic/streak';
import { addDays, weekdayOf, compareDates } from '../logic/dates';

/** How many trailing days the Task Manager's heatmap strip shows. */
export const DEFAULT_CELL_DAYS = 20;

/** One card per habit, in the same order task.list uses. */
export async function list(driver: SqlDriver, days: number): Promise<StreakCard[]> {
	const habits = await task.listRecurring(driver);
	const cards: StreakCard[] = [];
	for (const habit of habits) {
		cards.push(await build(driver, habit, days));
	}
	return cards;
}

/** `on = null` means today. Returns the recomputed card so the caller never has
 * to make a second round trip to see the new streak. */
export async function setCompletion(
	driver: SqlDriver,
	taskId: number,
	on: string | null,
	done: boolean,
	days: number
): Promise<StreakCard> {
	const habit = await task.get(driver, taskId);
	ensureRecurring(habit);

	const validatedOn = on === null ? todayFn() : parseDateOrThrow(on);
	await completion.set(driver, taskId, validatedOn, done);
	return build(driver, habit, days);
}

function ensureRecurring(habit: Task): void {
	if (!task.isRecurring(habit)) {
		throw AppError.validation(`task ${habit.id} is not recurring, so it has no streak`);
	}
}

/** Assembling a card without a cadence is a contradiction, not just missing
 * data — the caller already gets a validation error from ensureRecurring
 * before this ever reaches a task with no recurrence. */
async function build(driver: SqlDriver, habit: Task, days: number): Promise<StreakCard> {
	ensureRecurring(habit);
	const recurrence = habit.recurrence!;

	const today = todayFn();
	// History starts the day the habit was created: days before it existed are
	// not misses. A weekly habit's anchor is that same day's weekday.
	const created = localDateOf(habit.createdAt);
	const start = compareDates(created, today) < 0 ? created : today;
	const anchor = weekdayOf(start);
	const grace = await settings.graceDays(driver);

	const done = await completion.datesForTask(driver, habit.id, start, today);
	const expected = expectedDays(recurrence, anchor, start, today);
	const summary = summarize(expected, done, grace, today);

	const expectedSet = new Set(expected);
	const firstCell = addDays(today, -(days - 1));
	const cells: DayCell[] = [];
	for (let offset = 0; offset < days; offset += 1) {
		const day = addDays(firstCell, offset);
		const state: CellState = expectedSet.has(day) ? stateOf(day, done, grace, today) : 'not_expected';
		cells.push({ date: day, state });
	}

	return {
		task: habit,
		current: summary.current,
		longest: summary.longest,
		doneToday: done.has(today),
		cells
	};
}
