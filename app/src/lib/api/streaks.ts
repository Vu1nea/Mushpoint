import { request } from './http';
import { withQuery } from './query';
import type { StreakCard } from './types';

/** Omitting `days` lets the server pick its default window. */
export const listStreaks = (days?: number): Promise<StreakCard[]> =>
	request('GET', withQuery('/streaks', { days }));
/** `date` is a local `YYYY-MM-DD`; omit it to mean today. */
export const setTaskCompletion = (
	id: number,
	done: boolean,
	date: string | null = null
): Promise<StreakCard> => request('PUT', `/tasks/${id}/completion`, { done, date });
