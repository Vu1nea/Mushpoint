import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { Settings } from '../../api/types';
import { now } from './helpers';

/** Themes the app ships with. The frontend maps each name to a token set; this
 * only guards that an unknown name never gets persisted. */
export const THEMES: readonly string[] = ['nocturne', 'coquette'];

interface SettingsRow {
	active_theme: string;
	streak_grace_days: number;
	updated_at: string;
}

function map(row: SettingsRow): Settings {
	return {
		activeTheme: row.active_theme,
		streakGraceDays: row.streak_grace_days,
		updatedAt: row.updated_at
	};
}

export async function get(driver: SqlDriver): Promise<Settings> {
	const rows = await driver.select<SettingsRow>(
		'SELECT active_theme, streak_grace_days, updated_at FROM settings WHERE id = 1'
	);
	return map(rows[0]);
}

/** Just the grace number, for the streak math. Read on every streak computation
 * so changing it in Settings updates every card immediately. */
export async function graceDays(driver: SqlDriver): Promise<number> {
	const rows = await driver.select<{ streak_grace_days: number }>(
		'SELECT streak_grace_days FROM settings WHERE id = 1'
	);
	return rows[0].streak_grace_days;
}

export async function setTheme(driver: SqlDriver, theme: string): Promise<Settings> {
	if (!THEMES.includes(theme)) {
		throw AppError.validation(`unknown theme: ${theme}`);
	}
	await driver.execute('UPDATE settings SET active_theme = ?1, updated_at = ?2 WHERE id = 1', [
		theme,
		now()
	]);
	return get(driver);
}

/** Checked here as well as by the schema, so the UI gets a validation error with
 * a readable message instead of a raw constraint failure. */
export async function setGraceDays(driver: SqlDriver, days: number): Promise<Settings> {
	if (days < 0 || days > 7) {
		throw AppError.validation(`grace period must be between 0 and 7 days, got ${days}`);
	}
	await driver.execute(
		'UPDATE settings SET streak_grace_days = ?1, updated_at = ?2 WHERE id = 1',
		[days, now()]
	);
	return get(driver);
}
