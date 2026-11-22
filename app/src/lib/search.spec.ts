import { describe, expect, it } from 'vitest';
import type { Goal, Idea, Task } from './api/types';
import { searchItems } from './search';

const ts = '2026-01-01T00:00:00Z';
const goal = (id: number, title: string): Goal => ({
	id,
	categoryId: null,
	title,
	description: null,
	timeframe: 'short',
	status: 'active',
	dueDate: null,
	motivationText: null,
	motivationImagePath: null,
	repoUrl: null,
	createdAt: ts,
	updatedAt: ts
});
const task = (id: number, title: string): Task => ({
	id,
	title,
	status: 'todo',
	dueDate: null,
	goalId: null,
	subgoalId: null,
	recurrence: null,
	createdAt: ts,
	updatedAt: ts
});
const idea = (id: number, title: string): Idea => ({
	id,
	title,
	note: null,
	promotedGoalId: null,
	tags: [],
	createdAt: ts,
	updatedAt: ts
});

const data = {
	goals: [goal(1, 'Learn Rust'), goal(2, 'Run a marathon')],
	tasks: [task(3, 'Buy running shoes'), task(4, 'Rustproof the bike')],
	ideas: [idea(5, 'App for runners')]
};

describe('searchItems', () => {
	it('returns [] for empty and whitespace queries', () => {
		expect(searchItems('', data)).toEqual([]);
		expect(searchItems('   ', data)).toEqual([]);
	});

	it('is case-insensitive, builds hrefs and puts the prefix match first', () => {
		expect(searchItems('RUST', data)).toEqual([
			{ kind: 'task', id: 4, title: 'Rustproof the bike', href: '/tasks' },
			{ kind: 'goal', id: 1, title: 'Learn Rust', href: '/goals/1' }
		]);
	});

	it('ranks prefix matches before inner matches, keeping kind order', () => {
		const hits = searchItems('run', data);
		expect(hits.map((h) => [h.kind, h.id])).toEqual([
			['goal', 2],
			['task', 3],
			['idea', 5]
		]);
		expect(hits[2].href).toBe('/ideas');
	});

	it('respects the limit', () => {
		expect(searchItems('r', data, 2)).toHaveLength(2);
	});

	it('does not throw on a 200-char title', () => {
		const long = 'a'.repeat(200);
		const hits = searchItems('aaa', { goals: [goal(9, long)], tasks: [], ideas: [] });
		expect(hits).toHaveLength(1);
		expect(hits[0].href).toBe('/goals/9');
	});
});
