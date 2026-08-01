import { listGoals, listStreaks, listSubgoals, listTasks } from '$lib/api';

export const load = async () => {
	try {
		// Goals and subgoals come along so a task can name its parent and offer the
		// full parent list without a second round trip per card.
		const [tasks, streaks, goals, subgoals] = await Promise.all([
			listTasks(),
			listStreaks(),
			listGoals(),
			listSubgoals()
		]);
		return { tasks, streaks, goals, subgoals, error: null };
	} catch (error) {
		// Shown in place, so the board and its navigation stay usable.
		return { tasks: [], streaks: [], goals: [], subgoals: [], error };
	}
};
