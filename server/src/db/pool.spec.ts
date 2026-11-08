import { afterAll, expect, it, vi } from 'vitest';
import { createPool } from './pool';

const pool = createPool(process.env.MIGRATE_DATABASE_URL!);
afterAll(() => pool.end());

it('connects and runs a query', async () => {
  const { rows } = await pool.query('SELECT 1 AS n');
  expect(rows).toEqual([{ n: 1 }]);
});

it('survives an idle client error instead of crashing the process', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const p = createPool(process.env.MIGRATE_DATABASE_URL!);
  expect(() => p.emit('error', new Error('terminating connection due to administrator command'))).not.toThrow();
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
  return p.end();
});

it('returns bigint values as numbers', async () => {
  const { rows } = await pool.query('SELECT 5::bigint AS n');
  expect(rows[0].n).toBe(5);
});
