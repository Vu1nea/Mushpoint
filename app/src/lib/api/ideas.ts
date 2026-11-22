import { request } from './http';
import { withQuery } from './query';
import type { Goal, GoalInput, Idea, IdeaInput, Tag } from './types';

export const listIdeas = (opts?: { tag?: string; includePromoted?: boolean }): Promise<Idea[]> =>
	request(
		'GET',
		withQuery('/ideas', { tag: opts?.tag || null, includePromoted: opts?.includePromoted })
	);
export const getIdea = (id: number): Promise<Idea> => request('GET', `/ideas/${id}`);
export const createIdea = (input: IdeaInput): Promise<Idea> => request('POST', '/ideas', input);
export const updateIdea = (id: number, input: IdeaInput): Promise<Idea> =>
	request('PUT', `/ideas/${id}`, input);
export const deleteIdea = (id: number): Promise<void> => request('DELETE', `/ideas/${id}`);
/** Creates the goal and promotes the idea into it in one server transaction. */
export const promoteIdea = (id: number, goal: GoalInput): Promise<{ idea: Idea; goal: Goal }> =>
	request('POST', `/ideas/${id}/promote`, goal);
export const listIdeaTags = (): Promise<Tag[]> => request('GET', '/idea-tags');
