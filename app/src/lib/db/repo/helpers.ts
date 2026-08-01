import { AppError } from '../error';

/** Timestamps are stored as RFC 3339 strings — sortable as text, unambiguous
 * once read back. */
export function now(): string {
	return new Date().toISOString();
}

/** Trims a user-supplied name/title and rejects it if nothing is left. */
export function requiredText(field: string, value: string): string {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		throw AppError.validation(`${field} cannot be empty`);
	}
	return trimmed;
}

/** Trims an optional field, treating whitespace-only input as absent so the
 * database never holds a mix of NULL and "" for the same meaning. */
export function optionalText(value: string | null): string | null {
	if (value === null) return null;
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

/** Streaks are reckoned in local calendar days: a habit checked off at 11pm
 * belongs to that evening, not to tomorrow in UTC. */
export function today(): string {
	const d = new Date();
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The local calendar day a stored RFC 3339 timestamp fell on. */
export function localDateOf(timestamp: string): string {
	const d = new Date(timestamp);
	if (Number.isNaN(d.getTime())) {
		throw AppError.validation(`unreadable timestamp ${timestamp}`);
	}
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Validates a `YYYY-MM-DD` string is both well-formed and a real calendar date. */
export function parseDateOrThrow(value: string): string {
	const match = DATE_PATTERN.exec(value);
	if (!match) {
		throw AppError.validation(`bad date ${value}: expected YYYY-MM-DD`);
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const parsed = new Date(Date.UTC(year, month - 1, day));
	const roundTrips =
		parsed.getUTCFullYear() === year &&
		parsed.getUTCMonth() === month - 1 &&
		parsed.getUTCDate() === day;
	if (!roundTrips) {
		throw AppError.validation(`bad date ${value}: not a real date`);
	}
	return value;
}
