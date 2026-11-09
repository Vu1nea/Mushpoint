import type { SqlDriver } from '../db/driver';

// Children before parents; row-level security limits each DELETE to the caller.
const TABLES = [
  'idea_tag_links', 'idea_tags', 'ideas', 'task_completions', 'tasks', 'subgoals',
  'goals', 'vision_items', 'categories', 'settings', 'profiles'
];

/** Deletes every row the caller owns and records the tombstone. Idempotent. */
export async function deleteAllRows(driver: SqlDriver): Promise<void> {
  for (const table of TABLES) {
    await driver.execute(`DELETE FROM ${table}`);
  }
  await driver.execute(
    `INSERT INTO deleted_users (user_id, deleted_at)
     VALUES (current_setting('app.user_id')::uuid, now()) ON CONFLICT DO NOTHING`
  );
}
