import { describe, expect, it } from 'vitest';
import { createRequestCounter, moveIndex, shouldTogglePalette } from './paletteNav';

describe('moveIndex', () => {
	it('returns -1 when there are no results', () => {
		expect(moveIndex(0, 1, 0)).toBe(-1);
	});

	it('starts at the first or last result from no selection', () => {
		expect(moveIndex(-1, 1, 3)).toBe(0);
		expect(moveIndex(-1, -1, 3)).toBe(2);
	});

	it('steps and wraps at both ends', () => {
		expect(moveIndex(0, 1, 3)).toBe(1);
		expect(moveIndex(2, 1, 3)).toBe(0);
		expect(moveIndex(0, -1, 3)).toBe(2);
	});
});

describe('shouldTogglePalette', () => {
	const k = { key: 'k', ctrlKey: true, metaKey: false, altKey: false };

	it('toggles on Ctrl+K and Cmd+K', () => {
		expect(shouldTogglePalette(k, false, false)).toBe(true);
		expect(
			shouldTogglePalette({ ...k, ctrlKey: false, metaKey: true, key: 'K' }, false, false)
		).toBe(true);
	});

	it('ignores other keys and Alt combinations', () => {
		expect(shouldTogglePalette({ ...k, key: 'j' }, false, false)).toBe(false);
		expect(shouldTogglePalette({ ...k, ctrlKey: false }, false, false)).toBe(false);
		expect(shouldTogglePalette({ ...k, altKey: true }, false, false)).toBe(false);
	});

	it('does not open over another modal but may close itself', () => {
		expect(shouldTogglePalette(k, false, true)).toBe(false);
		expect(shouldTogglePalette(k, true, true)).toBe(true);
	});
});

describe('createRequestCounter', () => {
	it('only the newest token is current', () => {
		const c = createRequestCounter();
		const a = c.next();
		expect(c.isCurrent(a)).toBe(true);
		const b = c.next();
		expect(c.isCurrent(a)).toBe(false);
		expect(c.isCurrent(b)).toBe(true);
	});
});
