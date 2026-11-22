import type { Pool } from 'pg';
import type { SqlDriver } from '../db/driver';

/** Every table that holds per-user rows, children before parents. `deleted_users`
 * is not here: it is the tombstone, kept after the rest is gone. */
export const USER_TABLES = [
  'idea_tag_links', 'idea_tags', 'ideas', 'task_completions', 'tasks', 'subgoals',
  'goals', 'vision_items', 'categories', 'settings', 'profiles'
] as const;

/** Records the tombstone in its own committed statement, before anything is
 * deleted: from then on every request but `DELETE /account` is refused, even if
 * a later step fails. `deleted_users` has no row-level security. Idempotent. */
export async function recordTombstone(pool: Pool, userId: string): Promise<void> {
  await pool.query(
    'INSERT INTO deleted_users (user_id, deleted_at) VALUES ($1, now()) ON CONFLICT DO NOTHING',
    [userId]
  );
}

/** Every row the caller owns, table by table, parents first, columns as stored.
 * Row-level security limits each SELECT to the caller. */
export async function exportAllRows(driver: SqlDriver): Promise<Record<string, unknown[]>> {
  const tables: Record<string, unknown[]> = {};
  for (const table of [...USER_TABLES].reverse()) {
    tables[table] = await driver.select(`SELECT * FROM ${table} ORDER BY 1`);
  }
  return tables;
}

/** Storage paths of the caller's images, from the rows `exportAllRows` returned. */
export function imagePathsIn(tables: Record<string, unknown[]>): string[] {
  const column: Record<string, string> = {
    profiles: 'avatar_path',
    goals: 'motivation_image_path',
    vision_items: 'image_path'
  };
  const paths = Object.entries(column).flatMap(([table, name]) =>
    (tables[table] ?? []).map((row) => (row as Record<string, unknown>)[name])
  );
  return [...new Set(paths.filter((p): p is string => typeof p === 'string' && p !== ''))];
}

/** Deletes every row the caller owns; row-level security limits each DELETE to
 * the caller. Idempotent. */
export async function deleteAllRows(driver: SqlDriver): Promise<void> {
  for (const table of USER_TABLES) {
    await driver.execute(`DELETE FROM ${table}`);
  }
}
