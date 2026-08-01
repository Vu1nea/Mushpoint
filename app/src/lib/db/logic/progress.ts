import type { Task, TaskStatus } from '../../api/types';

/** Mean of the given completions, or 0 when there are no children at all. */
export function average(completions: number[]): number {
	if (completions.length === 0) return 0;
	return completions.reduce((sum, value) => sum + value, 0) / completions.length;
}

/** A subgoal with tasks is driven by its tasks; a subgoal with none falls back
 * to its own manual checkbox. */
export function subgoalProgress(isComplete: boolean, taskCompletions: number[]): number {
	if (taskCompletions.length === 0) return isComplete ? 1 : 0;
	return average(taskCompletions);
}

/** Subgoals and directly-linked tasks are equal-weight units of the parent. */
export function goalProgress(
	subgoalProgresses: number[],
	directTaskCompletions: number[]
): number {
	return average([...subgoalProgresses, ...directTaskCompletions]);
}

/** A task counts toward progress only once it is done; in_progress is a
 * workflow state, not partial credit. */
export function taskCompletion(status: TaskStatus): number {
	return status === 'done' ? 1 : 0;
}

/** A habit has no end state, so it is left out of the progress average entirely. */
export function countsTowardProgress(task: Task): boolean {
	return task.recurrence === null;
}
