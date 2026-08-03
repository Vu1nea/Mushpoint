import { error as httpError } from '@sveltejs/kit';

import { AppError, getGoal, listCategories, listGoals, listSubgoals } from '$lib/api';

export const load = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) httpError(404, 'Not a goal id');

	try {
		const [goal, categories, goals, subgoals] = await Promise.all([
			getGoal(id),
			listCategories(),
			listGoals(),
			listSubgoals()
		]);
		return { goal, categories, goals, subgoals, error: null };
	} catch (raw) {
		// A goal that does not exist is a genuine 404; anything else is shown
		// inline so the user keeps the page and its navigation.
		const failure = AppError.from(raw);
		if (failure.kind === 'not_found') httpError(404, failure.message);
		return { goal: null, categories: [], goals: [], subgoals: [], error: raw };
	}
};
