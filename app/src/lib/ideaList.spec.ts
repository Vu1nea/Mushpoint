import { describe, expect, it } from 'vitest';
import type { Idea } from './api/types';
import { filterIdeas, tagSummary } from './ideaList';

function idea(id: number, title: string, note: string | null = null, tags: string[] = []): Idea {
	return {
		id,
		title,
		note,
		promotedGoalId: null,
		tags: tags.map((name, i) => ({ id: id * 100 + i, name })),
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z'
	};
}

const ideas = [
	idea(1, 'Podcast about gardens', 'Interview local growers', ['audio', 'Home']),
	idea(2, 'Build a Cabin', null, ['home']),
	idea(3, 'Learn Rust', 'Start with the BOOK', []),
	idea(4, 'x'.repeat(200), null, ['long'])
];

describe('filterIdeas', () => {
	it('returns everything for an empty query and no tag', () => {
		expect(filterIdeas(ideas, { query: '', tag: null })).toEqual(ideas);
	});

	it('treats a whitespace query as empty', () => {
		expect(filterIdeas(ideas, { query: '   ', tag: null })).toEqual(ideas);
	});

	it('matches title, note and tag names case-insensitively', () => {
		expect(filterIdeas(ideas, { query: 'CABIN', tag: null }).map((i) => i.id)).toEqual([2]);
		expect(filterIdeas(ideas, { query: 'book', tag: null }).map((i) => i.id)).toEqual([3]);
		expect(filterIdeas(ideas, { query: 'AUDIO', tag: null }).map((i) => i.id)).toEqual([1]);
	});

	it('filters by tag, ignoring case', () => {
		expect(filterIdeas(ideas, { query: '', tag: 'home' }).map((i) => i.id)).toEqual([1, 2]);
	});

	it('combines query and tag', () => {
		expect(filterIdeas(ideas, { query: 'cabin', tag: 'home' }).map((i) => i.id)).toEqual([2]);
		expect(filterIdeas(ideas, { query: 'rust', tag: 'home' })).toEqual([]);
	});

	it('returns nothing when no idea matches', () => {
		expect(filterIdeas(ideas, { query: 'zzz', tag: null })).toEqual([]);
	});

	it('handles a 200-character title and a null note', () => {
		expect(filterIdeas(ideas, { query: 'xxxx', tag: null }).map((i) => i.id)).toEqual([4]);
		expect(filterIdeas([idea(5, 'No note')], { query: 'note', tag: null })).toHaveLength(1);
	});
});

describe('tagSummary', () => {
	const names = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i, name: `t${i}` }));

	it('shows every tag up to the limit', () => {
		expect(tagSummary(names(3), 3)).toEqual({ shown: names(3), more: 0 });
	});

	it('collapses the rest into a count', () => {
		expect(tagSummary(names(5), 3)).toEqual({ shown: names(3), more: 2 });
	});
});
