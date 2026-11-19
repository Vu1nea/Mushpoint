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

/**
 * Runs `fn` inside a single transaction that acts as `userId`. This is the
 * only place a request's user identity reaches Postgres.
 *
 * `userId` must already be trusted (the `sub` claim of a verified JWT); the
 * database takes it on faith.
 *
 * - Sets `app.user_id` with `set_config(..., true)`. The `true` makes it
 *   transaction-local: Postgres drops it on COMMIT or ROLLBACK, so a pooled
 *   connection never carries one user's id into another request. The
 *   setting only holds inside BEGIN, which is why `fn` must use the driver
 *   it is given and not open its own connection.
 * - RLS policies (`user_id = current_setting('app.user_id')::uuid`) limit
 *   every read and write to this user's rows, and `user_id` columns default
 *   to the same value on INSERT. This only works when the pool connects as
 *   `mushpoint_app`, which neither owns the tables nor has BYPASSRLS.
 * - Creates the user's settings row and default categories on first use
 *   (see `bootstrapUser`).
 * - Commits if `fn` resolves. Rolls back and rethrows if it throws, so a
 *   failed request writes nothing.
 */
export async function withUser<T>(
  pool: Pool,
  userId: string,
  fn: (driver: SqlDriver) => Promise<T>
): Promise<T> {
  if (!UUID.test(userId)) throw AppError.validation('user id must be a uuid');
  const client = await pool.connect();
  try {
    // Settings configuration transaction
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
