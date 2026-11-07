import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { SqlDriver } from '../db/driver';
import { createPgDriver } from '../db/pgDriver';
import { createPool } from '../db/pool';
import { bootstrapUser } from '../db/scope';

export const TEST_TZ = 'UTC';

export interface TestDb {
  driver: SqlDriver;
  userId: string;
  useUser(id: string): Promise<void>;
  release(): Promise<void>;
}

let appPool: ReturnType<typeof createPool> | undefined;
const pool = () => (appPool ??= createPool(process.env.DATABASE_URL!));

/** A driver inside a transaction that is always rolled back on release. */
export async function createTestDb(userId: string = randomUUID()): Promise<TestDb> {
  const client: PoolClient = await pool().connect();
  await client.query('BEGIN');
  const driver = createPgDriver(client);
  const db: TestDb = {
    driver,
    userId,
    async useUser(id) {
      db.userId = id;
      await client.query("SELECT set_config('app.user_id', $1, true)", [id]);
      await bootstrapUser(driver);
    },
    async release() {
      await client.query('ROLLBACK');
      client.release();
    }
  };
  await db.useUser(userId);
  return db;
}

const TABLES = [
  'task_completions', 'idea_tag_links', 'tasks', 'ideas', 'idea_tags',
  'subgoals', 'goals', 'categories', 'vision_items', 'settings'
];

/** For tests that commit: removes every row the given users own (owner connection bypasses RLS). */
export async function purgeUsers(userIds: string[]): Promise<void> {
  const owner = createPool(process.env.MIGRATE_DATABASE_URL!);
  try {
    for (const table of TABLES) {
      await owner.query(`DELETE FROM ${table} WHERE user_id = ANY($1::uuid[])`, [userIds]);
    }
  } finally {
    await owner.end();
  }
}
