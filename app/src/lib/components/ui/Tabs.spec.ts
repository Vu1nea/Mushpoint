import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Tabs from './Tabs.svelte';

describe('Tabs', () => {
	const html = render(Tabs, {
		props: {
			id: 'tasks-view',
			label: 'Task view',
			tabs: [
				{ value: 'board', label: 'Board' },
				{ value: 'calendar', label: 'Calendar' }
			],
			value: 'calendar',
			onChange: () => {}
		}
	}).body;

	const tabs = html.match(/<button[^>]*>/g) ?? [];

	it('renders a labelled tablist with one tab per option', () => {
		expect(html).toMatch(
			/role="tablist"[^>]*aria-label="Task view"|aria-label="Task view"[^>]*role="tablist"/
		);
		expect(tabs).toHaveLength(2);
		tabs.forEach((tab) => expect(tab).toContain('role="tab"'));
	});

	it('marks only the current tab selected and focusable', () => {
		expect(tabs[0]).toContain('aria-selected="false"');
		expect(tabs[0]).toContain('tabindex="-1"');
		expect(tabs[1]).toContain('aria-selected="true"');
		expect(tabs[1]).toContain('tabindex="0"');
	});

	it('links each tab to its panel', () => {
		expect(tabs[1]).toContain('id="tasks-view-tab-calendar"');
		expect(tabs[1]).toContain('aria-controls="tasks-view-panel-calendar"');
	});
});
