import { AppError } from './api/error';
import type { Recurrence } from './api/types';

/** All calendar-day arithmetic on `YYYY-MM-DD` strings goes through here, anchored
 * to UTC midnight so DST transitions never shift a day off by one. */

function toUtcDate(date: string): Date {
	const [year, month, day] = date.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day));
}

function fromUtcDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
	const d = toUtcDate(date);
	d.setUTCDate(d.getUTCDate() + days);
	return fromUtcDate(d);
}

/** `YYYY-MM-DD` strings already compare chronologically as plain strings; this
 * just names that fact so call sites read like a date comparison. */
export function compareDates(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/** 0 = Sunday .. 6 = Saturday, matching `Date.getUTCDay()`. */
export function weekdayOf(date: string): number {
	return toUtcDate(date).getUTCDay();
}

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

/** The local calendar day a stored RFC 3339 timestamp fell on. */
export function localDateOf(timestamp: string): string {
	const d = new Date(timestamp);
	if (Number.isNaN(d.getTime())) {
		throw AppError.validation(`unreadable timestamp ${timestamp}`);
	}
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const WEEKEND = new Set([0, 6]); // Sunday, Saturday

/** Whether the cadence expects an occurrence on this particular day.
 * `anchorWeekday` only matters for `weekly`; the other cadences ignore it. */
export function isExpectedOn(rec: Recurrence, anchorWeekday: number, day: string): boolean {
	if (rec === 'daily') return true;
	if (rec === 'weekdays') return !WEEKEND.has(weekdayOf(day));
	return weekdayOf(day) === anchorWeekday;
}
