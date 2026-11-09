import type { SqlDriver } from '../db/driver';
import { AppError } from '../error';
import { USERNAME_PATTERN, type Profile } from '../types';
import { now } from './helpers';

export async function get(driver: SqlDriver): Promise<Profile> {
  const rows = await driver.select<{ username: string }>('SELECT username FROM profiles');
  return { username: rows[0]?.username ?? null };
}

export async function setUsername(driver: SqlDriver, raw: string): Promise<Profile> {
  const username = raw.trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw AppError.validation('username must be 3-30 letters, numbers, _ or .');
  }
  try {
    await driver.execute(
      `INSERT INTO profiles (username, updated_at) VALUES (?1, ?2)
       ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, updated_at = EXCLUDED.updated_at`,
      [username, now()]
    );
  } catch (err) {
    if ((err as { code?: unknown })?.code === '23505') {
      throw AppError.validation('that username is taken');
    }
    throw err;
  }
  return { username };
}
