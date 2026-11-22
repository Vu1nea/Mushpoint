import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  localDateOf, MAX_TEXT, optionalText, optionalUrl, parseDateOrThrow, parseTimezone, requiredText, today
} from './helpers';
import { AppError } from '../error';

afterEach(() => vi.useRealTimers());

describe('requiredText', () => {
  it('trims and accepts non-blank input', () => {
    expect(requiredText('title', '  Ship v1  ')).toBe('Ship v1');
  });

  it('rejects blank or whitespace-only input', () => {
    expect(() => requiredText('title', '   ')).toThrow(AppError);
    expect(() => requiredText('title', '')).toThrow(expect.objectContaining({ kind: 'validation' }));
  });

  it('rejects non-strings with a validation error', () => {
    expect(() => requiredText('goal title', 123 as unknown as string)).toThrow(expect.objectContaining({ kind: 'validation' }));
    expect(() => requiredText('goal title', undefined as unknown as string)).toThrow(expect.objectContaining({ kind: 'validation' }));
  });
});

describe('text length cap', () => {
  it('accepts text at the cap', () => {
    expect(requiredText('title', 'x'.repeat(MAX_TEXT))).toHaveLength(MAX_TEXT);
    expect(optionalText('x'.repeat(MAX_TEXT))).toHaveLength(MAX_TEXT);
  });

  it('rejects text over the cap', () => {
    expect(() => requiredText('title', 'x'.repeat(MAX_TEXT + 1))).toThrow(expect.objectContaining({ kind: 'validation' }));
    expect(() => optionalText('x'.repeat(MAX_TEXT + 1))).toThrow(expect.objectContaining({ kind: 'validation' }));
  });
});

describe('optionalUrl', () => {
  it('accepts http and https URLs, trimmed', () => {
    expect(optionalUrl('  https://github.com/acme/widget ')).toBe('https://github.com/acme/widget');
    expect(optionalUrl('http://example.com')).toBe('http://example.com');
  });

  it('treats null and blank as absent', () => {
    expect(optionalUrl(null)).toBeNull();
    expect(optionalUrl('   ')).toBeNull();
  });

  it.each(['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', 'not a url', '//evil.com'])(
    'rejects %s',
    (raw) => {
      expect(() => optionalUrl(raw)).toThrow(expect.objectContaining({ kind: 'validation' }));
    }
  );
});

describe('optionalText', () => {
  it('trims non-empty values and passes null through', () => {
    expect(optionalText('  hi  ')).toBe('hi');
    expect(optionalText(null)).toBeNull();
  });

  it('treats whitespace-only input as absent', () => {
    expect(optionalText('   ')).toBeNull();
  });

  it('rejects non-string values but keeps null', () => {
    expect(optionalText(null)).toBeNull();
    expect(() => optionalText(5 as unknown as string)).toThrow(expect.objectContaining({ kind: 'validation' }));
  });
});

describe('timezones', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(today('UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("computes today in the user's zone, not the server's", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T23:30:00Z'));
    expect(today('Pacific/Kiritimati')).toBe('2026-01-02');
    expect(today('Pacific/Pago_Pago')).toBe('2026-01-01');
    expect(today('UTC')).toBe('2026-01-01');
  });

  it("localDateOf converts a stored timestamp into the user's zone", () => {
    expect(localDateOf('2026-01-01T23:30:00.000Z', 'Pacific/Kiritimati')).toBe('2026-01-02');
    expect(localDateOf('2026-01-01T23:30:00.000Z', 'Pacific/Pago_Pago')).toBe('2026-01-01');
  });

  it('localDateOf rejects unreadable timestamps', () => {
    expect(() => localDateOf('nope', 'UTC')).toThrow(/unreadable timestamp/);
  });

  it.each(['Etc/GMT+5', 'Etc/GMT-14'])('parseTimezone accepts the signed IANA zone %s', (raw) => {
    expect(parseTimezone(raw)).toBe(raw);
  });

  it.each([undefined, '', 'Mars/Base', 'UTC+3', '+03:00', '-05:00', ' UTC'])('parseTimezone rejects %s', (raw) => {
    expect(() => parseTimezone(raw)).toThrow(expect.objectContaining({ kind: 'validation' }));
  });

  it('parseTimezone accepts an IANA name', () => {
    expect(parseTimezone('America/New_York')).toBe('America/New_York');
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
