import { describe, expect, it } from 'vitest';

import { placePanel } from './popover.svelte';

const viewport = { width: 1000, height: 800 };
const panel = { width: 280, height: 320 };
const anchorAt = (top: number, left = 100, height = 36, width = 200) => ({
	top,
	bottom: top + height,
	left,
	width
});

describe('placePanel', () => {
	it('opens below the trigger when there is room', () => {
		expect(placePanel(anchorAt(100), panel, viewport)).toEqual({
			top: 142,
			bottom: null,
			left: 100,
			placement: 'below'
		});
	});

	it('flips above, pinned by its bottom edge, when the trigger is near the bottom of the screen', () => {
		// Anchor spans 700–736: only 50px below, 686px above.
		expect(placePanel(anchorAt(700), panel, viewport)).toEqual({
			top: null,
			bottom: 800 - 700 + 6,
			left: 100,
			placement: 'above'
		});
	});

	it('stays below when neither side fits but below has at least as much room', () => {
		const tall = { width: 280, height: 900 };
		expect(placePanel(anchorAt(300), tall, viewport)).toMatchObject({
			top: 342,
			bottom: null,
			placement: 'below'
		});
	});

	it('pins the top edge on-screen when neither side fits and above has more room', () => {
		const tall = { width: 280, height: 900 };
		expect(placePanel(anchorAt(600), tall, viewport)).toEqual({
			top: 8,
			bottom: null,
			left: 100,
			placement: 'above'
		});
	});

	it('clamps horizontally against the right edge', () => {
		expect(placePanel(anchorAt(100, 900), panel, viewport).left).toBe(1000 - 280 - 8);
	});

	it('clamps horizontally against the left edge', () => {
		expect(placePanel(anchorAt(100, -20), panel, viewport).left).toBe(8);
	});
});
