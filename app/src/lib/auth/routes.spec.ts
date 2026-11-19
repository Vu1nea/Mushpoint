import { describe, expect, it } from 'vitest';
import { isPublicRoute, safeNext } from './routes';

describe('safeNext', () => {
	it('keeps a same-origin path', () => {
		expect(safeNext('/goals/3')).toBe('/goals/3');
	});

	it.each(['https://evil.example', '//evil.example', '/\\evil', '/\t/evil.example', null, ''])(
		'falls back to / for %j',
		(raw) => {
			expect(safeNext(raw)).toBe('/');
		}
	);
});

describe('isPublicRoute', () => {
	it('is true for the auth callback', () => {
		expect(isPublicRoute('/auth/callback')).toBe(true);
	});

	it('is false for app screens', () => {
		expect(isPublicRoute('/goals')).toBe(false);
	});
});
