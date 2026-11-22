import { describe, expect, it } from 'vitest';
import { crumbsFor } from './crumbs';

describe('crumbsFor', () => {
	it('maps the root to Dashboard', () => {
		expect(crumbsFor('/')).toEqual([{ label: 'Dashboard' }]);
	});

	it.each([
		['/goals', 'Goals'],
		['/tasks', 'Tasks'],
		['/ideas', 'Ideas'],
		['/vision-board', 'Vision Board'],
		['/settings', 'Settings']
	])('maps %s to %s', (path, label) => {
		expect(crumbsFor(path)).toEqual([{ label }]);
	});

	it('links back to Goals from a goal detail page', () => {
		expect(crumbsFor('/goals/12')).toEqual([{ label: 'Goals', href: '/goals' }, { label: 'Goal' }]);
	});

	it('handles a trailing slash', () => {
		expect(crumbsFor('/tasks/')).toEqual([{ label: 'Tasks' }]);
		expect(crumbsFor('/goals/12/')).toEqual([
			{ label: 'Goals', href: '/goals' },
			{ label: 'Goal' }
		]);
	});

	it('falls back to Mushpoint for unknown paths', () => {
		expect(crumbsFor('/nope')).toEqual([{ label: 'Mushpoint' }]);
	});
});
