import { listCategories, listGoals, listStreaks, listSubgoals, listTasks, listVisionItems } from '$lib/api';

export const load = async () => {
	try {
		const [categories, goals, subgoals, tasks, streaks, visionItems] = await Promise.all([
			listCategories(),
			listGoals('active'),
			listSubgoals(),
			listTasks(),
			listStreaks(),
			listVisionItems()
		]);
		return { categories, goals, subgoals, tasks, streaks, visionItems, error: null };
	} catch (error) {
		return { categories: [], goals: [], subgoals: [], tasks: [], streaks: [], visionItems: [], error };
	}
};
