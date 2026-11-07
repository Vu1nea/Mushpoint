import type { Pool } from 'pg';
import { AppError } from '../error';
import type { SqlDriver } from './driver';
import { createPgDriver } from './pgDriver';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CATEGORIES: [string, string][] = [
  ['Work', 'accent-primary'],
  ['Gym', 'accent-secondary'],
  ['School', 'accent-tertiary'],
  ['Side Projects', 'accent-primary'],
  ['Social', 'accent-secondary']
];

/** Runs `fn` in one transaction scoped to `userId`: row-level security
 * restricts every statement to that user's rows. */
export async function withUser<T>(
  pool: Pool,
  userId: string,
  fn: (driver: SqlDriver) => Promise<T>
): Promise<T> {
  if (!UUID.test(userId)) throw AppError.validation('user id must be a uuid');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const driver = createPgDriver(client);
    await bootstrapUser(driver);
    const result = await fn(driver);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Idempotent. The advisory lock is taken only when the user looks new, so
 * ordinary parallel requests from an existing user never queue on it. */
export async function bootstrapUser(driver: SqlDriver): Promise<void> {
  if ((await driver.select('SELECT 1 FROM settings')).length > 0) return;
  await driver.select("SELECT pg_advisory_xact_lock(hashtextextended(current_setting('app.user_id'), 0))");
  if ((await driver.select('SELECT 1 FROM settings')).length > 0) return; // lost the race
  const stamp = new Date().toISOString();
  await driver.execute('INSERT INTO settings (updated_at) VALUES (?1)', [stamp]);
  for (const [name, token] of DEFAULT_CATEGORIES) {
    await driver.execute(
      'INSERT INTO categories (name, color_token, is_default, created_at) VALUES (?1, ?2, 1, ?3)',
      [name, token, stamp]
    );
  }
}
