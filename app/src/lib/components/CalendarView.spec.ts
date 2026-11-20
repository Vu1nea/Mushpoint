import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { GoalDetail } from '$lib/api';
import CalendarView from './CalendarView.svelte';
import GanttChart from './GanttChart.svelte';

const noop = () => {};

describe('CalendarView keyboard grid', () => {
	const html = render(CalendarView, {
		props: {
			tasks: [],
			subgoals: [],
			parentChipMode: 'subgoal-only',
			onMutated: noop,
			onError: noop,
			onEditTask: noop,
			onDeleteTask: noop,
			onCreateTask: noop
		}
	}).body;
	const dayButtons = html.match(/<button[^>]*data-day="[^"]+"[^>]*>/g) ?? [];

	it('puts one day in the tab order per layout (roving tabindex)', () => {
		// 42 days, each with a desktop and a phone button.
		expect(dayButtons).toHaveLength(84);
		const tabbable = dayButtons.filter((b) => b.includes('tabindex="0"'));
		expect(tabbable).toHaveLength(2);
		const days = tabbable.map((b) => /data-day="([^"]+)"/.exec(b)![1]);
		expect(days[0]).toBe(days[1]);
	});

	it('marks today and describes the keys', () => {
		expect(dayButtons.filter((b) => b.includes('aria-current="date"'))).toHaveLength(2);
		expect(html).toMatch(/role="group"[^>]*aria-describedby="calendar-keys-hint"/);
		expect(html).toContain('id="calendar-keys-hint"');
	});
});

describe('GanttChart', () => {
	const goal: Pick<GoalDetail, 'subgoals' | 'directTasks' | 'dueDate'> = {
		dueDate: null,
		directTasks: [],
		subgoals: [
			{
				id: 1,
				goalId: 1,
				title: 'Design',
				dueDate: '2000-01-15',
				isComplete: false,
				position: 0,
				createdAt: '2000-01-01T00:00:00Z',
				updatedAt: '2000-01-01T00:00:00Z',
				progress: 0,
				tasks: []
			}
		]
	};
	const html = render(GanttChart, { props: { goal } }).body;

	it('gives each bar a text label, including status shown by colour', () => {
		expect(html).toMatch(/<span class="sr-only">Subgoal Design, [^<]+, overdue<\/span>/);
		expect(html).toMatch(/>overdue</);
	});
});
