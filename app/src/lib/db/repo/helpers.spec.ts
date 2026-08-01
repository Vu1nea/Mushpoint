import { describe, expect, it } from 'vitest';
import { localDateOf, optionalText, parseDateOrThrow, requiredText, today } from './helpers';
import { AppError } from '../error';

describe('requiredText', () => {
	it('trims and accepts non-blank input', () => {
		expect(requiredText('title', '  Ship v1  ')).toBe('Ship v1');
	});

	it('rejects blank or whitespace-only input', () => {
		expect(() => requiredText('title', '   ')).toThrow(AppError);
		try {
			requiredText('title', '');
		} catch (err) {
			expect((err as AppError).kind).toBe('validation');
		}
	});
});

describe('optionalText', () => {
	it('trims non-empty values and passes null through', () => {
		expect(optionalText('  hi  ')).toBe('hi');
		expect(optionalText(null)).toBeNull();
	});

	it('treats whitespace-only input as absent', () => {
		expect(optionalText('   ')).toBeNull();
	});
});

describe('today', () => {
	it('returns a YYYY-MM-DD string', () => {
		expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('localDateOf', () => {
	it('reads the local calendar day of an RFC 3339 timestamp', () => {
		expect(localDateOf('2026-07-30T23:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('rejects an unreadable timestamp', () => {
		expect(() => localDateOf('not a date')).toThrow(AppError);
	});
});

describe('parseDateOrThrow', () => {
	it('accepts a well-formed calendar date', () => {
		expect(parseDateOrThrow('2026-07-31')).toBe('2026-07-31');
	});

	it('rejects malformed input', () => {
		expect(() => parseDateOrThrow('2026/07/31')).toThrow(AppError);
	});

	it('rejects a date that does not exist', () => {
		expect(() => parseDateOrThrow('2026-02-30')).toThrow(AppError);
	});
});
