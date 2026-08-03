import { listCategories, listIdeas, listIdeaTags } from '$lib/api';

export const load = async ({ url }) => {
	const tag = url.searchParams.get('tag') || undefined;

	try {
		const [ideas, tags, categories] = await Promise.all([
			listIdeas({ tag }),
			listIdeaTags(),
			listCategories()
		]);
		return { ideas, tags, categories, activeTag: tag ?? null, error: null };
	} catch (error) {
		// Shown in place, so the page and its navigation stay usable.
		return { ideas: [], tags: [], categories: [], activeTag: tag ?? null, error };
	}
};
