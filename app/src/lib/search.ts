import type { Goal, Idea, Task } from './api/types';

export type SearchHit = {
	kind: 'goal' | 'task' | 'idea';
	id: number;
	title: string;
	href: string;
};

export function searchItems(
	query: string,
	data: { goals: Goal[]; tasks: Task[]; ideas: Idea[] },
	limit = 8
): SearchHit[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];

	const all: SearchHit[] = [
		...data.goals.map((g) => ({
			kind: 'goal' as const,
			id: g.id,
			title: g.title,
			href: `/goals/${g.id}`
		})),
		...data.tasks.map((t) => ({
			kind: 'task' as const,
			id: t.id,
			title: t.title,
			href: '/tasks'
		})),
		...data.ideas.map((i) => ({
			kind: 'idea' as const,
			id: i.id,
			title: i.title,
			href: '/ideas'
		}))
	];

	const prefix: SearchHit[] = [];
	const inner: SearchHit[] = [];
	for (const hit of all) {
		const at = hit.title.toLowerCase().indexOf(q);
		if (at === 0) prefix.push(hit);
		else if (at > 0) inner.push(hit);
	}
	return [...prefix, ...inner].slice(0, Math.max(0, limit));
}
