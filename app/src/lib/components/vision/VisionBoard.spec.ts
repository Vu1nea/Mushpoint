import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { VisionItemView } from '$lib/api';
import StreakHeatmap from '../streaks/StreakHeatmap.svelte';
import VisionBoard from './VisionBoard.svelte';

const item = (id: number): VisionItemView => ({
	id,
	imagePath: null,
	imageUrl: null,
	quoteText: `Quote ${id}`,
	position: id,
	createdAt: '2026-07-01T00:00:00Z',
	updatedAt: '2026-07-01T00:00:00Z'
});

const noop = () => {};

describe('VisionBoard keyboard reordering (WCAG 2.5.7)', () => {
	const html = render(VisionBoard, {
		props: {
			items: [item(1), item(2), item(3)],
			busy: false,
			onReorder: noop,
			onEdit: noop,
			onDelete: noop,
			onAddNew: noop
		}
	}).body;
	const cards = html.split('<article').slice(1);

	it('labels each card with its position', () => {
		expect(cards).toHaveLength(3);
		expect(cards[1]).toContain('aria-label="Vision item 2 of 3"');
	});

	it('offers move buttons except past either end', () => {
		expect(cards[0]).not.toContain('Move earlier');
		expect(cards[0]).toContain('Move later');
		expect(cards[1]).toContain('Move earlier');
		expect(cards[1]).toContain('Move later');
		expect(cards[2]).toContain('Move earlier');
		expect(cards[2]).not.toContain('Move later');
	});

	it('has a polite live region for move announcements', () => {
		expect(html).toContain('aria-live="polite"');
	});
});

describe('VisionBoard sticky notes', () => {
	const html = render(VisionBoard, {
		props: {
			items: [item(1), item(2), { ...item(3), imageUrl: 'https://x.test/a.png' }],
			busy: false,
			onReorder: noop,
			onEdit: noop,
			onDelete: noop,
			onAddNew: noop
		}
	}).body;
	const cards = html.split('<article').slice(1);

	it('styles quote-only items as tilted notes with varied colors', () => {
		expect(cards[0]).toContain('rotate:');
		expect(cards[0]).toMatch(/bg-(yellow|pink|sky|lime|orange|violet)-200/);
		expect(cards[0]).not.toBe(cards[1]);
		expect(cards[0]).toMatch(/bg-\w+-200/);
		expect(cards[1]).toMatch(/bg-\w+-200/);
	});

	it('keeps image items as plain cards', () => {
		expect(cards[2]).not.toMatch(/bg-\w+-200/);
	});
});

describe('StreakHeatmap', () => {
	it('summarises the history in its accessible name', () => {
		const html = render(StreakHeatmap, {
			props: {
				cells: [
					{ date: '2026-07-30', state: 'done' },
					{ date: '2026-07-31', state: 'pending' }
				]
			}
		}).body;
		expect(html).toContain('aria-label="Completion history. Last 2 days: 1 done. Today: not yet."');
	});
});
