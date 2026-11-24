import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { DayCell } from '$lib/api';
import StreakHeatmap from './StreakHeatmap.svelte';

const cells: DayCell[] = [
	{ date: '2026-07-29', state: 'done' },
	{ date: '2026-07-30', state: 'missed' },
	{ date: '2026-07-31', state: 'pending' }
];

const html = (active?: boolean) =>
	render(StreakHeatmap, { props: active === undefined ? { cells } : { cells, active } }).body;

/** The class attribute of the first done cell (the one titled with a date). */
const doneCell = (body: string) => body.match(/<span class="[^"]*bg-accent[^"]*"/)?.[0] ?? '';

describe('StreakHeatmap done cells', () => {
	it('are green while the streak is alive', () => {
		expect(doneCell(html(true))).toContain('bg-accent-secondary');
	});

	it('are green by default', () => {
		expect(doneCell(html())).toContain('bg-accent-secondary');
	});

	it('use the accent colour once the streak has broken', () => {
		const cell = doneCell(html(false));
		expect(cell).toMatch(/\sbg-accent"/);
		expect(cell).not.toContain('bg-accent-secondary');
	});
});
