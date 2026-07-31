import { listGoals, listSubgoals, listTasks } from '$lib/api';

export const load = async () => {
	try {
		// Goals and subgoals come along so a task can name its parent and offer the
		// full parent list without a second round trip per card.
		const [tasks, goals, subgoals] = await Promise.all([listTasks(), listGoals(), listSubgoals()]);
		return { tasks, goals, subgoals, error: null };
	} catch (error) {
		// Shown in place, so the board and its navigation stay usable.
		return { tasks: [], goals: [], subgoals: [], error };
	}
};
