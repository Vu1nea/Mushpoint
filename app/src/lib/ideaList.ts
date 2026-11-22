import type { Idea, Tag } from './api/types';

export interface IdeaListFilter {
	query: string;
	tag: string | null;
}

/** Ideas matching a tag name and a case-insensitive query over title, note and tag names. */
export function filterIdeas(ideas: Idea[], { query, tag }: IdeaListFilter): Idea[] {
	const needle = query.trim().toLowerCase();
	const wanted = tag?.toLowerCase() ?? null;
	return ideas.filter(
		(idea) =>
			(wanted === null || idea.tags.some((t) => t.name.toLowerCase() === wanted)) &&
			(needle === '' ||
				idea.title.toLowerCase().includes(needle) ||
				(idea.note ?? '').toLowerCase().includes(needle) ||
				idea.tags.some((t) => t.name.toLowerCase().includes(needle)))
	);
}

/** The first `limit` tags to show and how many are folded into a "+N". */
export function tagSummary(tags: Tag[], limit: number): { shown: Tag[]; more: number } {
	return { shown: tags.slice(0, limit), more: Math.max(0, tags.length - limit) };
}
