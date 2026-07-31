import { listCategories, listGoals, type GoalStatus } from '$lib/api';

const FILTERS = ['active', 'completed', 'archived', 'all'] as const;
export type GoalFilter = (typeof FILTERS)[number];

function readFilter(value: string | null): GoalFilter {
	return FILTERS.includes(value as GoalFilter) ? (value as GoalFilter) : 'active';
}

export const load = async ({ url }) => {
	const filter = readFilter(url.searchParams.get('status'));
	const status: GoalStatus | null = filter === 'all' ? null : filter;

	try {
		const [goals, categories] = await Promise.all([listGoals(status), listCategories()]);
		return { filter, goals, categories, error: null };
	} catch (error) {
		// Loading errors are rendered in place rather than replacing the whole
		// screen, so the filter and navigation stay usable.
		return { filter, goals: [], categories: [], error };
	}
};
