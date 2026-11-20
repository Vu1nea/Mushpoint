import { describe, expect, it } from 'vitest';
import { exportFilename, withSignInEmail } from './download';

describe('exportFilename', () => {
	it('uses the local date', () => {
		expect(exportFilename(new Date(2026, 0, 5, 23, 59))).toBe('mushpoint-export-2026-01-05.json');
	});
});

describe('withSignInEmail', () => {
	it('adds the email and keeps the server document', () => {
		const doc = { format: 'mushpoint-export', tables: {} };
		expect(withSignInEmail(doc, 'a@example.com')).toEqual({ ...doc, signInEmail: 'a@example.com' });
		expect(doc).not.toHaveProperty('signInEmail');
	});
});
