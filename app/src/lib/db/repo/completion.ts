import type { SqlDriver } from '../driver';
import { now } from './helpers';

/** The completion log — one row per day a recurring task was done. This is the
 * source of truth; streak counters are always derived from it, never stored. */

/** Logs or unlogs one day. Logging a day twice is a no-op rather than an error —
 * the UI toggle should be safe to double-click. */
export async function set(
	driver: SqlDriver,
	taskId: number,
	on: string,
	done: boolean
): Promise<void> {
	if (done) {
		await driver.execute(
			`INSERT INTO task_completions (task_id, completed_on, created_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT (task_id, completed_on) DO NOTHING`,
			[taskId, on, now()]
		);
	} else {
		await driver.execute(
			'DELETE FROM task_completions WHERE task_id = ?1 AND completed_on = ?2',
			[taskId, on]
		);
	}
}

export async function datesForTask(
	driver: SqlDriver,
	taskId: number,
	from: string,
	to: string
): Promise<Set<string>> {
	const rows = await driver.select<{ completed_on: string }>(
		`SELECT completed_on FROM task_completions
         WHERE task_id = ?1 AND completed_on BETWEEN ?2 AND ?3`,
		[taskId, from, to]
	);
	return new Set(rows.map((row) => row.completed_on));
}
