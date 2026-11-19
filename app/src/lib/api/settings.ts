import { request } from './http';
import type { Settings } from './types';

export const getSettings = (): Promise<Settings> => request('GET', '/settings');
export const setActiveTheme = (theme: string): Promise<Settings> =>
	request('PUT', '/settings/theme', { theme });
export const setStreakGraceDays = (days: number): Promise<Settings> =>
	request('PUT', '/settings/streak-grace-days', { days });
