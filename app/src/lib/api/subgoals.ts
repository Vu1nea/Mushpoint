import { request } from './http';
import type { Subgoal, SubgoalInput, SubgoalUpdate } from './types';

export const listSubgoals = (): Promise<Subgoal[]> => request('GET', '/subgoals');
export const createSubgoal = (input: SubgoalInput): Promise<Subgoal> =>
	request('POST', '/subgoals', input);
export const updateSubgoal = (id: number, input: SubgoalUpdate): Promise<Subgoal> =>
	request('PUT', `/subgoals/${id}`, input);
export const setSubgoalComplete = (id: number, isComplete: boolean): Promise<Subgoal> =>
	request('PUT', `/subgoals/${id}/complete`, { isComplete });
export const deleteSubgoal = (id: number): Promise<void> => request('DELETE', `/subgoals/${id}`);
