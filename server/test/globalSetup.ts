import pg from 'pg';
import { migrate } from '../src/db/migrate';

export default async function setup(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.MIGRATE_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/postgres' });
  for (let i = 0; ; i++) {
    try {
      await client.connect();
      await client.query('SELECT 1');
      break;
    } catch {
      if (i >= 29) throw new Error('database unreachable: start the database with `npm run db:up`');
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  await client.end();
  await migrate(
    process.env.MIGRATE_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/postgres',
    process.env.MUSHPOINT_APP_PASSWORD ?? 'mushpoint_app'
  );
}
