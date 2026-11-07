import { afterAll, expect, it } from 'vitest';
import { createPool } from './pool';

const pool = createPool(process.env.MIGRATE_DATABASE_URL!);
afterAll(() => pool.end());

it('connects and runs a query', async () => {
  const { rows } = await pool.query('SELECT 1 AS n');
  expect(rows).toEqual([{ n: 1 }]);
});

it('returns bigint values as numbers', async () => {
  const { rows } = await pool.query('SELECT 5::bigint AS n');
  expect(rows[0].n).toBe(5);
});
