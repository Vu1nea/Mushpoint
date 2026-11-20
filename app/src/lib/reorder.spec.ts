import { describe, expect, it } from 'vitest';
import { moveId, moveIdBy } from './reorder';

describe('moveId', () => {
	it('moves an id to the target position', () => {
		expect(moveId([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 1, 4]);
		expect(moveId([1, 2, 3, 4], 4, 1)).toEqual([4, 1, 2, 3]);
	});

	it('returns null when nothing would change or an id is unknown', () => {
		expect(moveId([1, 2, 3], 2, 2)).toBeNull();
		expect(moveId([1, 2, 3], 9, 1)).toBeNull();
		expect(moveId([1, 2, 3], 1, 9)).toBeNull();
	});
});

describe('moveIdBy', () => {
	it('swaps with a neighbour', () => {
		expect(moveIdBy([1, 2, 3], 2, -1)).toEqual([2, 1, 3]);
		expect(moveIdBy([1, 2, 3], 2, 1)).toEqual([1, 3, 2]);
	});

	it('returns null at either end', () => {
		expect(moveIdBy([1, 2, 3], 1, -1)).toBeNull();
		expect(moveIdBy([1, 2, 3], 3, 1)).toBeNull();
		expect(moveIdBy([1, 2, 3], 9, 1)).toBeNull();
	});
});
