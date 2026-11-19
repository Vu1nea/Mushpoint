import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createPool } from './pool';
import { toPg } from './pgDriver';
import { withUser } from './scope';
import { purgeUsers } from '../testSupport/db';

const pool = createPool(process.env.DATABASE_URL!);
const users: string[] = [];
const newUser = () => {
  const id = randomUUID();
  users.push(id);
  return id;
};
afterAll(async () => {
  await purgeUsers(users);
  await pool.end();
});

describe('toPg', () => {
  it('rewrites ?N placeholders, including repeated ones', () => {
    expect(toPg('UPDATE t SET a = ?1, b = ?2, c = ?2 WHERE id = ?10')).toBe(
      'UPDATE t SET a = $1, b = $2, c = $2 WHERE id = $10'
    );
  });
});

describe('withUser', () => {
  it('reports lastInsertId and rowsAffected', async () => {
    await withUser(pool, newUser(), async (db) => {
      const ins = await db.execute("INSERT INTO ideas (title, created_at, updated_at) VALUES ('a','n','n') RETURNING id");
      expect(ins.lastInsertId).toBeGreaterThan(0);
      const upd = await db.execute("UPDATE ideas SET title = 'b' WHERE id = ?1", [ins.lastInsertId]);
      expect(upd.rowsAffected).toBe(1);
    });
  });

  it('bootstraps defaults for a new user', async () => {
    const id = newUser();
    await withUser(pool, id, async (db) => {
      const cats = await db.select<{ name: string }>('SELECT name FROM categories ORDER BY id');
      expect(cats.map((c) => c.name)).toEqual(['Work', 'Gym', 'School', 'Side Projects', 'Social']);
      const settings = await db.select<{ active_theme: string; streak_grace_days: number }>('SELECT * FROM settings');
      expect(settings).toMatchObject([{ active_theme: 'nocturne', streak_grace_days: 2 }]);
    });
  });

  it('creates defaults exactly once under concurrent first requests', async () => {
    const id = newUser();
    await Promise.all(Array.from({ length: 6 }, () => withUser(pool, id, async () => undefined)));
    await withUser(pool, id, async (db) => {
      expect((await db.select('SELECT 1 FROM categories')).length).toBe(5);
      expect((await db.select('SELECT 1 FROM settings')).length).toBe(1);
    });
  });

  it('rolls back everything when the callback throws', async () => {
    const id = newUser();
    await expect(
      withUser(pool, id, async (db) => {
        await db.execute("INSERT INTO ideas (title, created_at, updated_at) VALUES ('x','n','n')");
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    await withUser(pool, id, async (db) => {
      expect((await db.select('SELECT 1 FROM ideas')).length).toBe(0);
    });
  });

  it('keeps users apart', async () => {
    const a = newUser();
    const b = newUser();
    await withUser(pool, a, (db) => db.execute("INSERT INTO ideas (title, created_at, updated_at) VALUES ('mine','n','n')"));
    await withUser(pool, b, async (db) => expect(await db.select('SELECT 1 FROM ideas')).toEqual([]));
  });

  it('rejects a non-uuid user id before using the database', async () => {
    await expect(withUser(pool, "x'; drop table goals;--", async () => undefined)).rejects.toMatchObject({ kind: 'validation' });
  });
});
