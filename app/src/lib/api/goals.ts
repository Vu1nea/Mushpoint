import { request } from './http';
import { withQuery } from './query';
import type { Goal, GoalDetail, GoalInput, GoalStatus, GoalSummary } from './types';

export const listGoals = (status: GoalStatus | null = null): Promise<GoalSummary[]> =>
	request('GET', withQuery('/goals', { status }));
export const getGoal = (id: number): Promise<GoalDetail> => request('GET', `/goals/${id}`);
export const createGoal = (input: GoalInput): Promise<Goal> => request('POST', '/goals', input);
export const updateGoal = (id: number, input: GoalInput): Promise<Goal> =>
	request('PUT', `/goals/${id}`, input);
export const setGoalStatus = (id: number, status: GoalStatus): Promise<Goal> =>
	request('PUT', `/goals/${id}/status`, { status });
export const deleteGoal = (id: number, deleteOrphanedTasks: boolean): Promise<void> =>
	request('DELETE', withQuery(`/goals/${id}`, { deleteOrphanedTasks }));
