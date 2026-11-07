import { readdirSync } from 'node:fs';
import { afterAll, expect, it } from 'vitest';
import { createPool } from './pool';
import { migrate } from './migrate';

const owner = createPool(process.env.MIGRATE_DATABASE_URL!);
afterAll(() => owner.end());

it('is idempotent and records each file once', async () => {
  await migrate(process.env.MIGRATE_DATABASE_URL!, 'mushpoint_app');
  await migrate(process.env.MIGRATE_DATABASE_URL!, 'mushpoint_app');
  const files = readdirSync(new URL('./migrations/', import.meta.url)).filter((f) => f.endsWith('.sql'));
  const { rows } = await owner.query('SELECT count(*) AS n FROM schema_migrations');
  expect(rows[0].n).toBe(files.length);
});

it('does not let the app role touch schema_migrations', async () => {
  const app = createPool(process.env.DATABASE_URL!);
  await expect(app.query('SELECT * FROM schema_migrations')).rejects.toThrow(/permission denied/);
  await app.end();
});
