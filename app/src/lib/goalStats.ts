import type { GoalDetail, SubgoalDetail, TaskSummary } from './api/types';
import { taskColumn } from './kanban';

export interface GoalStats {
	progressPct: number;
	subgoalsDone: number;
	subgoalsTotal: number;
	tasksDone: number;
	tasksTotal: number;
}

/**
 * Numbers for the goal-detail stat strip. Progress is the server's own 0-1
 * ratio (the same one the progress bar shows); a subgoal counts as done at
 * 100%, a task by the column it shows in on the board.
 */
export function goalStats(
	goal: Pick<GoalDetail, 'progress'>,
	subgoals: Pick<SubgoalDetail, 'progress'>[],
	tasks: TaskSummary[]
): GoalStats {
	return {
		progressPct: Math.round(goal.progress * 100),
		subgoalsDone: subgoals.filter((subgoal) => subgoal.progress >= 1).length,
		subgoalsTotal: subgoals.length,
		tasksDone: tasks.filter((task) => taskColumn(task) === 'done').length,
		tasksTotal: tasks.length
	};
}
