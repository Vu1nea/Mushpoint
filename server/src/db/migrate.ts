import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPool } from './pool';

const DIR = fileURLToPath(new URL('./migrations/', import.meta.url));

export async function migrate(connectionString: string, appPassword?: string): Promise<void> {
  const pool = createPool(connectionString);
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727274)'); // one migrator at a time
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
    );
    const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const done = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
      if (done.rowCount) continue;
      await client.query('BEGIN');
      try {
        await client.query(await readFile(DIR + file, 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    if (appPassword) {
      await client.query(`ALTER ROLE mushpoint_app PASSWORD ${client.escapeLiteral(appPassword)}`);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)').catch(() => {});
    client.release();
    await pool.end();
  }
}
