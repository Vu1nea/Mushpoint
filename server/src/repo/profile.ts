import type { SqlDriver } from '../db/driver';
import { AppError } from '../error';
import { USERNAME_PATTERN } from '../types';
import { nowIso } from './helpers';

/** The profile as stored; routes swap `avatarPath` for a signed `avatarUrl`. */
export interface StoredProfile {
  username: string | null;
  avatarPath: string | null;
}

interface ProfileRow {
  username: string;
  avatar_path: string | null;
}

const map = (row: ProfileRow | undefined): StoredProfile => ({
  username: row?.username ?? null,
  avatarPath: row?.avatar_path ?? null
});

export async function get(driver: SqlDriver): Promise<StoredProfile> {
  const rows = await driver.select<ProfileRow>('SELECT username, avatar_path FROM profiles');
  return map(rows[0]);
}

export async function setUsername(driver: SqlDriver, raw: string): Promise<StoredProfile> {
  const username = raw.trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw AppError.validation('username must be 3-30 letters, numbers, _ or .');
  }
  try {
    const rows = await driver.select<ProfileRow>(
      `INSERT INTO profiles (username, updated_at) VALUES (?1, ?2)
       ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, updated_at = EXCLUDED.updated_at
       RETURNING username, avatar_path`,
      [username, nowIso()]
    );
    return map(rows[0]);
  } catch (err) {
    if ((err as { code?: unknown })?.code === '23505') {
      throw AppError.validation('that username is taken');
    }
    throw err;
  }
}

/** Sets or clears the picture and returns the path it replaced, if any.
 * The profile row exists only once a username is picked. */
export async function setAvatar(
  driver: SqlDriver,
  avatarPath: string | null
): Promise<{ profile: StoredProfile; replaced: string | null }> {
  const before = await driver.select<ProfileRow>('SELECT username, avatar_path FROM profiles FOR UPDATE');
  if (!before[0]) throw AppError.validation('pick a username first');
  const rows = await driver.select<ProfileRow>(
    `UPDATE profiles SET avatar_path = ?1, updated_at = ?2 RETURNING username, avatar_path`,
    [avatarPath, nowIso()]
  );
  const old = before[0].avatar_path;
  return { profile: map(rows[0]), replaced: old !== null && old !== avatarPath ? old : null };
}
