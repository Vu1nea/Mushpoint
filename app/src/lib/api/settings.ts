import { call } from './client';
import type { Settings } from './types';

export const getSettings = () => call<Settings>('get_settings');
export const setActiveTheme = (theme: string) => call<Settings>('set_active_theme', { theme });
export const setStreakGraceDays = (days: number) =>
	call<Settings>('set_streak_grace_days', { days });
