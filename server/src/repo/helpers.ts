import { AppError } from '../error';

/** Timestamps are stored as RFC 3339 strings — sortable as text, unambiguous
 * once read back. */
export function now(): string {
  return new Date().toISOString();
}

/** Trims a user-supplied name/title and rejects it if nothing is left. */
export function requiredText(field: string, value: string): string {
  if (typeof value !== 'string') throw AppError.validation(`${field} must be text`);
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
  if (typeof value !== 'string') throw AppError.validation('value must be text or null');
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** The calendar day of an instant in the given IANA zone, as YYYY-MM-DD. */
function ymd(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Streaks are reckoned in the user's local calendar days, never the server's. */
export function today(tz: string): string {
  return ymd(new Date(), tz);
}

/** The local calendar day a stored RFC 3339 timestamp fell on, in `tz`. */
export function localDateOf(timestamp: string, tz: string): string {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) {
    throw AppError.validation(`unreadable timestamp ${timestamp}`);
  }
  return ymd(d, tz);
}

/** Validates an `X-Timezone` header value: a real IANA zone name. */
export function parseTimezone(raw: string | undefined): string {
  if (!raw || /[+\s]/.test(raw)) throw AppError.validation('X-Timezone header must be an IANA time zone');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: raw });
  } catch {
    throw AppError.validation('X-Timezone header must be an IANA time zone');
  }
  return raw;
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
