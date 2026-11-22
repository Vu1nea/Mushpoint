import { describe, expect, it } from 'vitest';
import { moveIndex } from './paletteNav';

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
