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
