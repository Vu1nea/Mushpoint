import { describe, expect, it } from 'vitest';

import {
	flattenOptions,
	isGroup,
	labelFor,
	typeaheadIndex,
	type SelectItem
} from './selectOptions';

describe('isGroup', () => {
	it('tells options and groups apart', () => {
		expect(isGroup({ value: 'a', label: 'A' })).toBe(false);
		expect(isGroup({ label: 'Group', options: [] })).toBe(true);
	});
});

describe('flattenOptions', () => {
	it('leaves a flat list unchanged', () => {
		const items: SelectItem[] = [
			{ value: 'a', label: 'A' },
			{ value: 'b', label: 'B' }
		];
		expect(flattenOptions(items)).toEqual(items);
	});

	it('flattens groups in place, preserving order', () => {
		const items: SelectItem[] = [
			{ value: '', label: 'Standalone' },
			{
				label: 'Goal 1',
				options: [
					{ value: 'goal:1', label: 'Goal 1 (whole goal)' },
					{ value: 'subgoal:1', label: '↳ Sub 1' }
				]
			},
			{ label: 'Goal 2', options: [{ value: 'goal:2', label: 'Goal 2 (whole goal)' }] }
		];
		expect(flattenOptions(items)).toEqual([
			{ value: '', label: 'Standalone' },
			{ value: 'goal:1', label: 'Goal 1 (whole goal)' },
			{ value: 'subgoal:1', label: '↳ Sub 1' },
			{ value: 'goal:2', label: 'Goal 2 (whole goal)' }
		]);
	});
});

describe('labelFor', () => {
	const items: SelectItem[] = [
		{ value: '', label: 'Standalone' },
		{ label: 'Goal 1', options: [{ value: 'goal:1', label: 'Goal 1 (whole goal)' }] }
	];

	it('finds a top-level option', () => {
		expect(labelFor(items, '')).toBe('Standalone');
	});

	it('finds an option nested in a group', () => {
		expect(labelFor(items, 'goal:1')).toBe('Goal 1 (whole goal)');
	});

	it('returns undefined for no match', () => {
		expect(labelFor(items, 'missing')).toBeUndefined();
	});
});

describe('typeaheadIndex', () => {
	const labels = ['Daily', 'Doesn’t repeat', 'Weekdays', 'Weekly'];

	it('jumps to the next label starting with a typed letter, wrapping', () => {
		expect(typeaheadIndex(labels, 0, 'w')).toBe(2);
		expect(typeaheadIndex(labels, 3, 'd')).toBe(0);
	});

	it('cycles through matches when the same letter is typed again', () => {
		expect(typeaheadIndex(labels, 0, 'd')).toBe(1);
		expect(typeaheadIndex(labels, 1, 'dd')).toBe(0);
		expect(typeaheadIndex(labels, 2, 'ww')).toBe(3);
	});

	it('keeps the current option while a longer prefix still matches it', () => {
		expect(typeaheadIndex(labels, 2, 'week')).toBe(2);
		expect(typeaheadIndex(labels, 2, 'weekl')).toBe(3);
	});

	it('ignores case and returns -1 when nothing matches', () => {
		expect(typeaheadIndex(labels, 0, 'WEEKLY')).toBe(3);
		expect(typeaheadIndex(labels, 0, 'z')).toBe(-1);
		expect(typeaheadIndex([], 0, 'a')).toBe(-1);
	});
});
