import { describe, expect, it } from 'vitest';
import { createPool } from '../db/pool';
import { USER_TABLES } from './account';

/** Tables with a `user_id` that account deletion deliberately keeps. */
const KEPT = ['deleted_users'];

describe('account deletion coverage', () => {
  it('deletes from every public table that has a user_id column', async () => {
    // The owner connection sees every column, whatever the app role is granted.
    const owner = createPool(process.env.MIGRATE_DATABASE_URL!);
    try {
      const { rows } = await owner.query<{ table_name: string }>(
        `SELECT DISTINCT c.table_name FROM information_schema.columns c
           JOIN information_schema.tables t
             ON t.table_schema = c.table_schema AND t.table_name = c.table_name
          WHERE c.table_schema = 'public' AND c.column_name = 'user_id'
            AND t.table_type = 'BASE TABLE'`
      );
      const withUserId = rows.map((r) => r.table_name).filter((t) => !KEPT.includes(t));
      expect(withUserId.length).toBeGreaterThan(0);
      expect([...USER_TABLES].sort()).toEqual(withUserId.sort());
    } finally {
      await owner.end();
    }
  });
});
