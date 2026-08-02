import { getDriver } from '../db/connection';
import * as settingsRepo from '../db/repo/settings';
import type { Settings } from './types';

export const getSettings = async (): Promise<Settings> => settingsRepo.get(await getDriver());
export const setActiveTheme = async (theme: string): Promise<Settings> =>
	settingsRepo.setTheme(await getDriver(), theme);
export const setStreakGraceDays = async (days: number): Promise<Settings> =>
	settingsRepo.setGraceDays(await getDriver(), days);
