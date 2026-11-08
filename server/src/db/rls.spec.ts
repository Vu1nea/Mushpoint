import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { createPool } from './pool';

const app = createPool(process.env.DATABASE_URL!);
afterAll(() => app.end());
const A = randomUUID();
const B = randomUUID();

async function inTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await app.connect();
  try {
    await c.query('BEGIN');
    return await fn(c);
  } finally {
    await c.query('ROLLBACK');
    c.release();
  }
}
const as = (c: PoolClient, id: string) => c.query("SELECT set_config('app.user_id', $1, true)", [id]);
const addCategory = (c: PoolClient, name: string) =>
  c.query("INSERT INTO categories (name, created_at) VALUES ($1, 'now') RETURNING id, user_id", [name]);

describe('row-level security', () => {
  it('stamps user_id from the session setting', async () => {
    await inTx(async (c) => {
      await as(c, A);
      const { rows } = await addCategory(c, 'Work');
      expect(rows[0].user_id).toBe(A);
    });
  });

  it("hides, and refuses to change, another user's rows", async () => {
    await inTx(async (c) => {
      await as(c, A);
      const { rows } = await addCategory(c, 'Work');
      await as(c, B);
      expect((await c.query('SELECT * FROM categories')).rowCount).toBe(0);
      expect((await c.query('UPDATE categories SET name = $1 WHERE id = $2', ['x', rows[0].id])).rowCount).toBe(0);
      expect((await c.query('DELETE FROM categories WHERE id = $1', [rows[0].id])).rowCount).toBe(0);
      await as(c, A);
      expect((await c.query('SELECT * FROM categories')).rowCount).toBe(1);
    });
  });

  it('refuses to insert a row for another user', async () => {
    await inTx(async (c) => {
      await as(c, A);
      await expect(
        c.query("INSERT INTO categories (user_id, name, created_at) VALUES ($1, 'Z', 'now')", [B])
      ).rejects.toThrow(/row-level security/);
    });
  });

  it('fails closed when no user is set', async () => {
    await inTx(async (c) => {
      await expect(c.query('SELECT * FROM goals')).rejects.toThrow();
    });
  });

  it('allows the same category name for two users but not twice for one', async () => {
    await inTx(async (c) => {
      await as(c, A);
      await addCategory(c, 'Work');
      await as(c, B);
      await addCategory(c, 'Work');
      await as(c, A);
      await expect(addCategory(c, 'Work')).rejects.toMatchObject({ code: '23505' });
    });
  });

  it('treats tag names as case-insensitively unique per user', async () => {
    await inTx(async (c) => {
      await as(c, A);
      await c.query("INSERT INTO idea_tags (name, created_at) VALUES ('CS', 'now')");
      await c.query('SAVEPOINT s'); // a failed statement would otherwise abort the transaction
      await expect(c.query("INSERT INTO idea_tags (name, created_at) VALUES ('cs', 'now')")).rejects.toMatchObject({ code: '23505' });
      await c.query('ROLLBACK TO SAVEPOINT s');
      await as(c, B);
      await c.query("INSERT INTO idea_tags (name, created_at) VALUES ('cs', 'now')");
    });
  });

  it('covers every table: all user tables have RLS enabled and forced', async () => {
    const owner = createPool(process.env.MIGRATE_DATABASE_URL!);
    const { rows } = await owner.query(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'schema_migrations'
         AND NOT (c.relrowsecurity AND c.relforcerowsecurity)`
    );
    await owner.end();
    expect(rows).toEqual([]);
  });

  it('grants every policy to the app role only (never public, anon or authenticated)', async () => {
    const owner = createPool(process.env.MIGRATE_DATABASE_URL!);
    const { rows } = await owner.query(
      `SELECT tablename, roles::text[] AS roles FROM pg_policies WHERE schemaname = 'public'`
    );
    await owner.end();
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const row of rows) expect({ table: row.tablename, roles: row.roles }).toEqual({ table: row.tablename, roles: ['mushpoint_app'] });
  });
});
