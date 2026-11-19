# Phase 1: API Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tested Express API in `server/` that serves every operation the desktop app's `app/src/lib/api/index.ts` and `settings.ts` offer, for many users at once, with Postgres row-level security isolating them, Supabase-issued tokens authenticating them, and a container image that runs it.

**Architecture:** `server/` is a new package next to `app/`. Repos and pure logic are ported from `app/src/lib/db/` with the `SqlDriver` seam kept, so the port is mostly mechanical SQL changes. Each HTTP request runs inside one Postgres transaction that first executes `set_config('app.user_id', <verified user id>, true)`; tables default `user_id` from that setting and a policy restricts every row to it, so repo SQL has no per-query user filter. Supabase is used only for tokens (JWKS verification) and image storage; the database in this phase is plain Postgres from docker compose.

**Tech Stack:** Node 24, TypeScript (strict), Express 5, `pg`, `jose`, `multer`, esbuild (production bundle), tsx (dev), Vitest + `supertest`, Postgres 16 via docker compose.

**Specs:** `docs/superpowers/specs/2026-11-06-hosted-server-design.md` (design). Roadmap: `docs/superpowers/plans/2026-11-06-hosted-server.md` (outline of all phases; where it differs from this document, this document wins).

**Phase output:** `cd server && npm test` green; `npm run check` clean; `docker build` produces a runnable image; `curl` against the running container's `/api/healthz` works. No Supabase project is needed until the optional manual smoke at the end of Task 11.

## Global Constraints

- Node 24, TypeScript strict, ESM, **extensionless relative imports** (copied code uses them; tsx, Vitest and esbuild all resolve them; `tsc` runs only as `--noEmit` with `moduleResolution: Bundler`).
- Repos are Postgres-only. `app/` is not modified in this phase.
- Owner key `user_id uuid` (Supabase user id); no users table; no FK to `auth.users`.
- The API connects as role `mushpoint_app` (`NOBYPASSRLS`), never as `postgres` or a Supabase service role.
- Every request that reads or computes "today"/local dates needs `X-Timezone` (IANA); the server clock's zone is never used. Tests run with `TZ=UTC` and a `TEST_TZ = 'UTC'` constant so ported specs keep their local-date semantics.
- `server/src/types.ts` is a byte-identical copy of `app/src/lib/api/types.ts`; API-only extras live in `server/src/viewTypes.ts`.
- All error responses: `{ "kind": ErrorKind, "message": string }`. 400 validation (malformed JSON, wrong field types, Postgres data/constraint errors), 401 unauthenticated, 404 not_found, 500 otherwise. A 500 never contains a raw database or stack message.
- API lives under `/api`. No CORS (single origin via ingress).
- Image paths are `<userId>/<uuid>.<png|jpg|webp|gif>` in private bucket `vision`.
- `Goal.motivationImagePath` has no UI that sets it (checked: `GoalDrawer` only echoes it, `DashboardQuickAdd` sends null). The server stores it as plain text and does not sign or validate it. Out of scope.
- Dependencies are added with `npm install` (no hand-pinned versions); commit the lockfile.

## Review Focus

Each line names the task that tests it.

1. User B reading, updating or deleting user A's record by id gets 404; creating a task/subgoal/idea-promotion that references A's goal/subgoal/category fails (Tasks 6, 7, 9).
2. Missing, malformed, expired, wrong-issuer, wrong-audience, wrong-algorithm or forged tokens → 401 with no database connection acquired (Task 8).
3. Two simultaneous first requests from a brand-new user create exactly 5 categories and 1 settings row (Task 3).
4. A UTC server serving `Pacific/Kiritimati` / `Pacific/Pago_Pago` users computes "today" and a habit's start date in their zone; missing/unknown timezone → 400 on routes that need it (Tasks 5, 7, 8).
5. Image upload with wrong type, spoofed content type, empty body or >5 MB → 400; a vision item referencing another user's image path or a path with `..` → 400; deleting/replacing an item removes the old object (Task 10).
6. Category names are unique per user (case-sensitive, as before); tag names are unique per user case-insensitively; two users may both own "Work" (Tasks 2, 6, 7).
7. Wrong-typed or hostile bodies (`{"title": 123}`, `{}`, `{"timeframe":"bogus"}`, `{"categoryId":"abc"}`) → 400, never 500 and never a leaked SQL message (Tasks 6, 9).
8. API types never drift from the web client's (Task 4 byte-identity test).

---

## Task 1: Scaffold, build tooling and Postgres test harness

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/test/globalSetup.ts`, `server/docker-compose.yml`, `server/.env.example`, `server/.dockerignore`, `server/src/db/pool.ts`, `server/src/db/pool.spec.ts`
- Modify: `.gitignore` (add `server/node_modules`, `server/dist`, `server/.env`)

**Interfaces:**
- Produces: `createPool(connectionString: string): Pool` in `server/src/db/pool.ts`. npm scripts used by every later task: `test`, `check`, `dev`, `build`, `start`, `migrate`, `db:up`, `db:down`.

- [ ] **Step 1: Create the package and install.** In `server/`: `npm init -y`, then set `"private": true, "type": "module", "engines": {"node": ">=24"}`. Install runtime deps `express pg jose multer`; dev deps `typescript tsx esbuild vitest supertest @types/node @types/express @types/pg @types/multer @types/supertest`. Scripts:

```json
{
  "dev": "tsx watch --env-file=.env src/main.ts",
  "build": "rm -rf dist && esbuild src/main.ts src/db/migrateCli.ts --bundle --platform=node --format=esm --packages=external --target=node24 --sourcemap --outdir=dist && cp -r src/db/migrations dist/db/migrations",
  "start": "node dist/main.js",
  "migrate": "tsx --env-file=.env src/db/migrateCli.ts",
  "test": "vitest run",
  "check": "tsc --noEmit",
  "db:up": "docker compose up -d --wait",
  "db:down": "docker compose down -v"
}
```

- [ ] **Step 2: Config files.**
  - `tsconfig.json`: `target ES2023`, `module ESNext`, `moduleResolution Bundler`, `strict true`, `noEmit true`, `skipLibCheck true`, `esModuleInterop true`, `types ["node"]`, `include ["src", "test", "vitest.config.ts"]`.
  - `docker-compose.yml`: one service `db`, image `postgres:16`, `POSTGRES_PASSWORD=postgres`, ports `54329:5432`, healthcheck `pg_isready -U postgres`.
  - `.env.example` documents (values for local dev): `MIGRATE_DATABASE_URL=postgres://postgres:postgres@localhost:54329/postgres`, `DATABASE_URL=postgres://mushpoint_app:mushpoint_app@localhost:54329/postgres`, `MUSHPOINT_APP_PASSWORD=mushpoint_app`, `SUPABASE_URL=`, `SUPABASE_SERVICE_KEY=`, `PORT=3000`. Copy it to `.env`.
  - `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
process.env.TZ = 'UTC'; // ported specs assume local dates == UTC dates
export default defineConfig({
  test: {
    globalSetup: ['./test/globalSetup.ts'],
    env: {
      MIGRATE_DATABASE_URL: 'postgres://postgres:postgres@localhost:54329/postgres',
      DATABASE_URL: 'postgres://mushpoint_app:mushpoint_app@localhost:54329/postgres',
      MUSHPOINT_APP_PASSWORD: 'mushpoint_app',
      TZ: 'UTC'
    }
  }
});
```

  - `test/globalSetup.ts` (for now only waits for the database; Task 2 adds migrating): retry `SELECT 1` against `MIGRATE_DATABASE_URL` up to 30 times at 500 ms, then throw "start the database with `npm run db:up`".

- [ ] **Step 3: Write the failing test** `src/db/pool.spec.ts`:

```ts
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
```

- [ ] **Step 4: Run** `npm run db:up && npm test`. Expected: FAIL, "Cannot find module './pool'".
- [ ] **Step 5: Implement** `src/db/pool.ts`:

```ts
import pg from 'pg';

// bigint ids and counts arrive as numbers (ids never approach 2^53 here).
pg.types.setTypeParser(20, (value) => Number(value));

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 10 });
}
```

- [ ] **Step 6: Run** `npm test && npm run check`. Expected: 2 tests pass, type check clean. Commit `feat(server): scaffold with postgres test harness`.

---

## Task 2: Schema, row-level security and migration runner

**Files:**
- Create: `server/src/db/migrations/0001_init.sql`, `server/src/db/migrate.ts`, `server/src/db/migrateCli.ts`, `server/src/db/migrate.spec.ts`, `server/src/db/rls.spec.ts`
- Modify: `server/test/globalSetup.ts` (run `migrate` after the database is reachable)

**Interfaces:**
- Consumes: `createPool`.
- Produces: `migrate(connectionString: string, appPassword?: string): Promise<void>`; CLI `migrateCli.ts` reading `MIGRATE_DATABASE_URL` and `MUSHPOINT_APP_PASSWORD` and exiting non-zero on failure; role `mushpoint_app`.

- [ ] **Step 1: Write the failing tests.**

`migrate.spec.ts`:

```ts
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
```

`rls.spec.ts` (connects as the app role; every test runs in a transaction that is always rolled back):

```ts
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

  it('hides, and refuses to change, another user\'s rows', async () => {
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
      await expect(c.query("INSERT INTO idea_tags (name, created_at) VALUES ('cs', 'now')")).rejects.toMatchObject({ code: '23505' });
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
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL (no `migrate`, no tables).
- [ ] **Step 3: Write `0001_init.sql`.** Final-state schema of `app/src-tauri/migrations/0001`-`0005` (including `recurrence`, `repo_url`, `streak_grace_days`), with these pinned changes. Table list and columns:

| Table | Columns (besides `user_id`, see below) |
|---|---|
| `categories` | `id`, `name text NOT NULL`, `color_token text`, `is_default integer NOT NULL DEFAULT 0`, `created_at text NOT NULL`; unique index `(user_id, name)` |
| `goals` | `id`, `category_id bigint REFERENCES categories(id) ON DELETE SET NULL`, `title text NOT NULL`, `description`, `timeframe text NOT NULL CHECK (timeframe IN ('short','mid','long'))`, `status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived'))`, `due_date`, `motivation_text`, `motivation_image_path`, `repo_url`, `created_at`, `updated_at` |
| `subgoals` | `id`, `goal_id bigint NOT NULL REFERENCES goals(id) ON DELETE CASCADE`, `title`, `due_date`, `is_complete integer NOT NULL DEFAULT 0`, `position integer NOT NULL DEFAULT 0`, `created_at`, `updated_at` |
| `tasks` | `id`, `title`, `status` (todo/in_progress/done check, default todo), `due_date`, `goal_id … ON DELETE SET NULL`, `subgoal_id … ON DELETE SET NULL`, `recurrence text CHECK (recurrence IS NULL OR recurrence IN ('daily','weekdays','weekly'))`, `created_at`, `updated_at` |
| `task_completions` | `id`, `task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE`, `completed_on text NOT NULL`, `created_at`, `UNIQUE (task_id, completed_on)` |
| `settings` | **no `id`**; `user_id` is the primary key; `active_theme text NOT NULL DEFAULT 'nocturne'`, `streak_grace_days integer NOT NULL DEFAULT 2 CHECK (streak_grace_days BETWEEN 0 AND 7)`, `updated_at text NOT NULL` |
| `ideas` | `id`, `title`, `note`, `promoted_goal_id … REFERENCES goals(id) ON DELETE SET NULL`, `created_at`, `updated_at` |
| `idea_tags` | `id`, `name text NOT NULL`, `created_at`; unique index `(user_id, lower(name))` |
| `idea_tag_links` | `idea_id … ON DELETE CASCADE`, `tag_id … ON DELETE CASCADE`, `PRIMARY KEY (idea_id, tag_id)` |
| `vision_items` | `id`, `image_path`, `quote_text`, `position integer NOT NULL`, `created_at`, `updated_at`, `CHECK (image_path IS NOT NULL OR quote_text IS NOT NULL)` |

  Rules that apply to every table:
  - `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY` (all but `settings`, `idea_tag_links`).
  - `user_id uuid NOT NULL DEFAULT current_setting('app.user_id')::uuid` (on `settings` it is also the primary key).
  - All the original indexes (`idx_goals_category`, `idx_tasks_goal`, …) are kept; add `(user_id)` indexes on `goals`, `tasks`, `ideas`, `vision_items`.
  - No seed rows (Task 3 seeds per user).
  - After the tables, one block enables isolation for all ten tables:

```sql
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','goals','subgoals','tasks','task_completions',
                           'settings','ideas','idea_tags','idea_tag_links','vision_items']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY own_rows ON %I USING (user_id = current_setting(''app.user_id'')::uuid)', t);
  END LOOP;
END $$;
```

  - The role and grants come first/last in the file:

```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mushpoint_app') THEN
    CREATE ROLE mushpoint_app LOGIN NOBYPASSRLS;
  END IF;
END $$;
-- ... tables, policies ...
GRANT USAGE ON SCHEMA public TO mushpoint_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mushpoint_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mushpoint_app;
REVOKE ALL ON schema_migrations FROM mushpoint_app;
```

- [ ] **Step 4: Implement `migrate.ts`.**

```ts
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
```

  `migrateCli.ts`: reads the two env vars (fail with a clear message if `MIGRATE_DATABASE_URL` is missing), awaits `migrate`, prints "migrations applied", exits 1 on error.
  Update `test/globalSetup.ts` to call `migrate(MIGRATE_DATABASE_URL, MUSHPOINT_APP_PASSWORD)` once the database answers.

- [ ] **Step 5: Run** `npm test`. Expected: all pass. If `FORCE ROW LEVEL SECURITY` blocks the owner in a later test that needs setup data, use the owner pool only for `DELETE`s guarded by explicit `user_id` (superuser bypasses RLS regardless). Commit `feat(server): schema with row-level security and migrations`.

---

## Task 3: Postgres driver, per-user scope and test harness

**Files:**
- Create: `server/src/error.ts` (verbatim copy of `app/src/lib/db/error.ts`; Task 4 adds the `unauthenticated` kind), `server/src/db/driver.ts` (verbatim copy of `app/src/lib/db/driver.ts`), `server/src/db/pgDriver.ts`, `server/src/db/scope.ts`, `server/src/testSupport/db.ts`, `server/src/db/scope.spec.ts`

> `scope.ts` throws `AppError`, which is why `error.ts` is copied here, before Task 4's remaining ports.

**Interfaces:**
- Consumes: `Pool`, schema (Task 2).
- Produces:

```ts
// pgDriver.ts
export function toPg(sql: string): string;                       // ?N -> $N
export function createPgDriver(client: PoolClient): SqlDriver;
// scope.ts
export function withUser<T>(pool: Pool, userId: string, fn: (driver: SqlDriver) => Promise<T>): Promise<T>;
export function bootstrapUser(driver: SqlDriver): Promise<void>;
// testSupport/db.ts
export const TEST_TZ = 'UTC';
export interface TestDb { driver: SqlDriver; userId: string; useUser(id: string): Promise<void>; release(): Promise<void> }
export function createTestDb(userId?: string): Promise<TestDb>;
export function purgeUsers(userIds: string[]): Promise<void>;     // owner connection; for tests that commit
```

- [ ] **Step 1: Write the failing tests** `scope.spec.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createPool } from './pool';
import { toPg } from './pgDriver';
import { withUser } from './scope';
import { purgeUsers } from '../testSupport/db';

const pool = createPool(process.env.DATABASE_URL!);
const users: string[] = [];
const newUser = () => { const id = randomUUID(); users.push(id); return id; };
afterAll(async () => { await purgeUsers(users); await pool.end(); });

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
    await Promise.all(
      Array.from({ length: 6 }, () => withUser(pool, id, async () => undefined))
    );
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
    const a = newUser(); const b = newUser();
    await withUser(pool, a, (db) => db.execute("INSERT INTO ideas (title, created_at, updated_at) VALUES ('mine','n','n')"));
    await withUser(pool, b, async (db) => expect(await db.select('SELECT 1 FROM ideas')).toEqual([]));
  });

  it('rejects a non-uuid user id before using the database', async () => {
    await expect(withUser(pool, "x'; drop table goals;--", async () => undefined)).rejects.toMatchObject({ kind: 'validation' });
  });
});
```

- [ ] **Step 2: Run** → FAIL (modules missing).
- [ ] **Step 3: Implement `pgDriver.ts`.**

```ts
import type { PoolClient } from 'pg';
import type { QueryResult, SqlDriver } from './driver';

const PLACEHOLDER = /\?(\d+)/g;
/** Repos use ?N placeholders; none of their SQL has a literal '?' in a string. */
export const toPg = (sql: string): string => sql.replace(PLACEHOLDER, '$$$1');

export function createPgDriver(client: PoolClient): SqlDriver {
  return {
    async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return (await client.query(toPg(sql), params)).rows as T[];
    },
    async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
      const result = await client.query(toPg(sql), params);
      const first = result.rows[0] as { id?: unknown } | undefined;
      return {
        lastInsertId: typeof first?.id === 'number' ? first.id : 0,
        rowsAffected: result.rowCount ?? 0
      };
    }
  };
}
```

- [ ] **Step 4: Implement `scope.ts`.**

```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CATEGORIES: [string, string][] = [
  ['Work', 'accent-primary'], ['Gym', 'accent-secondary'], ['School', 'accent-tertiary'],
  ['Side Projects', 'accent-primary'], ['Social', 'accent-secondary']
];

export async function withUser<T>(pool: Pool, userId: string, fn: (driver: SqlDriver) => Promise<T>): Promise<T> {
  if (!UUID.test(userId)) throw AppError.validation('user id must be a uuid');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const driver = createPgDriver(client);
    await bootstrapUser(driver);
    const result = await fn(driver);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Idempotent. The advisory lock is taken only when the user looks new, so
 * ordinary parallel requests from an existing user never queue on it. */
export async function bootstrapUser(driver: SqlDriver): Promise<void> {
  if ((await driver.select('SELECT 1 FROM settings')).length > 0) return;
  await driver.select("SELECT pg_advisory_xact_lock(hashtextextended(current_setting('app.user_id'), 0))");
  if ((await driver.select('SELECT 1 FROM settings')).length > 0) return; // lost the race
  const stamp = new Date().toISOString();
  await driver.execute('INSERT INTO settings (updated_at) VALUES (?1)', [stamp]);
  for (const [name, token] of DEFAULT_CATEGORIES) {
    await driver.execute(
      'INSERT INTO categories (name, color_token, is_default, created_at) VALUES (?1, ?2, 1, ?3)',
      [name, token, stamp]
    );
  }
}
```

- [ ] **Step 5: Implement `testSupport/db.ts`.** A module-level pool on `DATABASE_URL`. `createTestDb(userId = randomUUID())` checks out a client, `BEGIN`, sets the user, wraps it with `createPgDriver`, runs `bootstrapUser`, and returns `{ driver, userId, useUser, release }`: `useUser(id)` re-runs `set_config` and `bootstrapUser` on the same client (so one test can act as user A and then B inside one transaction); `release()` rolls back and releases. `purgeUsers` opens an owner pool (`MIGRATE_DATABASE_URL`) and deletes `WHERE user_id = ANY($1)` from every table in reverse dependency order (`task_completions`, `idea_tag_links`, `tasks`, `ideas`, `idea_tags`, `subgoals`, `goals`, `categories`, `vision_items`, `settings`).
- [ ] **Step 6: Run** `npm test && npm run check`. Expected: all pass. Commit `feat(server): pg driver and per-user scope`.

---

## Task 4: Port errors, API types and pure logic

**Files:**
- Create: `server/src/error.ts` (finish), `server/src/types.ts`, `server/src/viewTypes.ts`, `server/src/types.spec.ts`, `server/src/logic/{dates,progress,streak}.ts`, `server/src/logic/{dates,progress,streak}.spec.ts`, `server/src/error.spec.ts`

**Interfaces:**
- Produces: `ErrorKind` now includes `'unauthenticated'`; `AppError.unauthenticated(message: string): AppError`. `viewTypes.ts`: `export type VisionItemView = VisionItem & { imageUrl: string | null }`. Everything else identical to the originals.

- [ ] **Step 1: Write the failing test** `types.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('matches the web client API types byte for byte', () => {
  const server = readFileSync(new URL('./types.ts', import.meta.url), 'utf8');
  const web = readFileSync(new URL('../../app/src/lib/api/types.ts', import.meta.url), 'utf8');
  expect(server).toBe(web);
});
```

Also add to `error.spec.ts` (copied from `app/src/lib/db/error.spec.ts`) a case: `AppError.unauthenticated('x').kind === 'unauthenticated'` and `isUserFixable` is false for it.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Copy and fix imports.** Mapping rule for every file ported in Tasks 4-7:

| Original import | Server import |
|---|---|
| `'../driver'` (from repo) | `'../db/driver'` |
| `'../error'` / `'./error'` | `'../error'` (from repo/logic) |
| `'../../api/types'` | `'../types'` |
| `'../logic/…'`, `'./helpers'` | unchanged |

  `logic/*` imports `../../api/types` → `../types`. Specs move alongside with the same mapping.
- [ ] **Step 4: Run** `npm test && npm run check`. Expected: all pass (logic is pure; behaviour unchanged). Commit `feat(server): port error, types and pure logic`.

---

## Task 5: Timezone-aware helpers and input guards

**Files:**
- Create: `server/src/repo/helpers.ts`, `server/src/repo/helpers.spec.ts` (from `app/src/lib/db/repo/helpers.ts` and its spec)

**Interfaces:**
- Produces:

```ts
export function now(): string;                                    // unchanged, UTC ISO
export function requiredText(field: string, value: string): string;   // now rejects non-strings
export function optionalText(value: string | null): string | null;    // now rejects non-string, non-null
export function parseDateOrThrow(value: string): string;              // unchanged
export function today(tz: string): string;                            // changed
export function localDateOf(timestamp: string, tz: string): string;   // changed
export function parseTimezone(raw: string | undefined): string;       // new
```

- [ ] **Step 1: Write failing tests** (in addition to the ported cases, with `today()`/`localDateOf()` call sites given `TEST_TZ`):

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(() => vi.useRealTimers());

describe('timezones', () => {
  it('computes today in the user\'s zone, not the server\'s', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T23:30:00Z'));
    expect(today('Pacific/Kiritimati')).toBe('2026-01-02');
    expect(today('Pacific/Pago_Pago')).toBe('2026-01-01');
    expect(today('UTC')).toBe('2026-01-01');
  });
  it('localDateOf converts a stored timestamp into the user\'s zone', () => {
    expect(localDateOf('2026-01-01T23:30:00.000Z', 'Pacific/Kiritimati')).toBe('2026-01-02');
    expect(localDateOf('2026-01-01T23:30:00.000Z', 'Pacific/Pago_Pago')).toBe('2026-01-01');
  });
  it('localDateOf rejects unreadable timestamps', () => {
    expect(() => localDateOf('nope', 'UTC')).toThrow(/unreadable timestamp/);
  });
  it.each([undefined, '', 'Mars/Base', 'UTC+3'])('parseTimezone rejects %s', (raw) => {
    expect(() => parseTimezone(raw)).toThrow(expect.objectContaining({ kind: 'validation' }));
  });
  it('parseTimezone accepts an IANA name', () => {
    expect(parseTimezone('America/New_York')).toBe('America/New_York');
  });
});

describe('text guards', () => {
  it('requiredText rejects non-strings with a validation error', () => {
    expect(() => requiredText('goal title', 123 as unknown as string)).toThrow(expect.objectContaining({ kind: 'validation' }));
    expect(() => requiredText('goal title', undefined as unknown as string)).toThrow(expect.objectContaining({ kind: 'validation' }));
  });
  it('optionalText rejects non-string values but keeps null', () => {
    expect(optionalText(null)).toBeNull();
    expect(() => optionalText(5 as unknown as string)).toThrow(expect.objectContaining({ kind: 'validation' }));
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** A shared private `ymd(date: Date, tz: string)` using `Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)` and assembling `YYYY-MM-DD` from the parts (do not rely on the `en-CA` locale's output format). `parseTimezone` constructs an `Intl.DateTimeFormat` with the zone inside try/catch and requires the name to contain no `+`/space (reject offsets like `UTC+3`, which some runtimes accept). Guards: `typeof value !== 'string'` → `AppError.validation(\`${field} must be text\`)`.
- [ ] **Step 4: Run** `npm test`. Expected: pass. Commit `feat(server): timezone-aware helpers and text guards`.

---

## Task 6: Port the core repos

**Files:**
- Create (ported from `app/src/lib/db/repo/`, specs alongside): `server/src/repo/{category,settings,subgoal,task,goal}.ts`, `*.spec.ts`

**Interfaces:**
- Consumes: `SqlDriver`, helpers, types, `TestDb`.
- Produces (changed signatures only; everything else identical to the originals):

```ts
// task.ts
export function list(driver: SqlDriver, tz: string): Promise<TaskSummary[]>;
export function listForSubgoal(driver: SqlDriver, subgoalId: number, tz: string): Promise<TaskSummary[]>;
export function listDirectForGoal(driver: SqlDriver, goalId: number, tz: string): Promise<TaskSummary[]>;
// subgoal.ts
export function detailForGoal(driver: SqlDriver, goalId: number, tz: string): Promise<SubgoalDetail[]>;
export function progressesForGoal(driver: SqlDriver, goalId: number, tz: string): Promise<number[]>;
// goal.ts
export function list(driver: SqlDriver, status: GoalStatus | null, tz: string): Promise<GoalSummary[]>;
export function getDetail(driver: SqlDriver, id: number, tz: string): Promise<GoalDetail>;
```

- [ ] **Step 1: Copy repos and specs** with the Task 4 import mapping. Convert each spec's setup mechanically:

```ts
let t: TestDb;
let driver: SqlDriver;
beforeEach(async () => { t = await createTestDb(); driver = t.driver; });
afterEach(async () => { await t.release(); });
```

  Raw SQL in specs: add `RETURNING id` to the `INSERT`s whose `lastInsertId` is read (`seedGoal`, `seedSubgoal`); replace `datetime('now')` with a bound `now()` value; `UPDATE settings … WHERE id = 1` → `UPDATE settings SET …` (RLS scopes it). Calls to the six changed functions and to `today()` receive `TEST_TZ`.
- [ ] **Step 2: Add the new tests** to the respective specs:

```ts
// category.spec.ts
it('lets two users own a category with the same name', async () => {
  await category.create(driver, { name: 'Hobbies', colorToken: null });
  await t.useUser(randomUUID());
  await expect(category.create(driver, { name: 'Hobbies', colorToken: null })).resolves.toMatchObject({ name: 'Hobbies' });
});
it('still rejects a duplicate for the same user', async () => {
  await category.create(driver, { name: 'Hobbies', colorToken: null });
  await expect(category.create(driver, { name: 'Hobbies', colorToken: null }))
    .rejects.toMatchObject({ kind: 'validation', message: 'a category with that name already exists' });
});

// goal.spec.ts  (isolation)
it("does not let another user see or touch my goal", async () => {
  const mine = await goal.create(driver, goalInput());
  await t.useUser(randomUUID());
  await expect(goal.get(driver, mine.id)).rejects.toMatchObject({ kind: 'not_found' });
  await expect(goal.update(driver, mine.id, goalInput())).rejects.toMatchObject({ kind: 'not_found' });
  await expect(goal.remove(driver, mine.id, false)).rejects.toMatchObject({ kind: 'not_found' });
  expect(await goal.list(driver, null, TEST_TZ)).toEqual([]);
});
it("refuses a category that belongs to another user", async () => {
  const theirs = await category.create(driver, { name: 'Private', colorToken: null });
  await t.useUser(randomUUID());
  await expect(goal.create(driver, { ...goalInput(), categoryId: theirs.id })).rejects.toMatchObject({ kind: 'not_found' });
});

// task.spec.ts
it("refuses another user's goal or subgoal as a parent", async () => {
  const g = await seedGoal(); const s = await seedSubgoal(g);
  await t.useUser(randomUUID());
  await expect(task.create(driver, { ...taskInput(), goalId: g })).rejects.toMatchObject({ kind: 'not_found' });
  await expect(task.create(driver, { ...taskInput(), subgoalId: s })).rejects.toMatchObject({ kind: 'not_found' });
});
// subgoal.spec.ts
it("refuses to add a subgoal to another user's goal", async () => {
  const g = await seedGoal();
  await t.useUser(randomUUID());
  await expect(subgoal.create(driver, { goalId: g, title: 'x', dueDate: null })).rejects.toMatchObject({ kind: 'not_found' });
});
```

  (`goalInput()`/`taskInput()` are small local builders returning a full valid input; `seedGoal`/`seedSubgoal` come from the ported specs.)
- [ ] **Step 3: Run** `npm test -- repo`. Expected: FAIL (SQLite-isms, signatures).
- [ ] **Step 4: Port the SQL and signatures.** Exactly these edits, nothing else (no behaviour changes):

| File | Change |
|---|---|
| `category.ts` | `create`: append `RETURNING id` to the `INSERT`. Keep `duplicateNameAsValidation` as is (`/unique/i` matches Postgres' "duplicate key value violates unique constraint"). |
| `settings.ts` | Drop `WHERE id = 1` from the three selects; the two `UPDATE`s become `… WHERE user_id = current_setting('app.user_id')::uuid` (explicit even though RLS also applies). |
| `subgoal.ts` | `create`: `RETURNING id`. `detailForGoal`/`progressesForGoal`: take `tz`, pass it to `task.listForSubgoal`. |
| `task.ts` | `create`: `RETURNING id`. `list`, `listForSubgoal`, `listDirectForGoal`, and private `withCompletion`: take `tz`; `today()` → `today(tz)`; `localDateOf(createdAt)` → `localDateOf(createdAt, tz)`. `completed_today` comes back as a boolean; `Boolean(...)` already handles it. |
| `goal.ts` | `create`: `RETURNING id`. `list`/`getDetail`: take `tz`, pass to subgoal/task calls. `fromIdeaIds` placeholders are already `?1…?n`; unchanged. |

  Everything else (`ORDER BY (due_date IS NULL), due_date`, `COALESCE(MAX(position) + 1, 0)`, `?9, ?9` reuse) is valid Postgres as written. The N+1 query pattern in `goal.list` is preserved on purpose (same behaviour; one transaction per request).
- [ ] **Step 5: Run** `npm test && npm run check`. Expected: pass. Commit `feat(server): port category, settings, subgoal, task and goal repos`.

---

## Task 7: Port streak, completion, idea and vision repos

**Files:**
- Create (ported, specs alongside): `server/src/repo/{completion,streak,idea,visionItem}.ts`

**Interfaces:**
- Produces:

```ts
// streak.ts
export const DEFAULT_CELL_DAYS = 20;
export function list(driver: SqlDriver, days: number, tz: string): Promise<StreakCard[]>;
export function setCompletion(driver: SqlDriver, taskId: number, on: string | null, done: boolean, days: number, tz: string): Promise<StreakCard>;
// idea.ts / visionItem.ts / completion.ts: signatures unchanged
```

- [ ] **Step 1: Copy repos and specs** (same mapping and spec conversion as Task 6). In `streak.spec.ts` `UPDATE settings … WHERE id = 1` loses its `WHERE`; the `INSERT INTO task_completions` raw SQL is unchanged.
- [ ] **Step 2: Add the new tests.**

```ts
// streak.spec.ts
it("starts a habit's history on the user's local creation date", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-10T10:00:00Z'));
  await task.create(driver, { ...taskInput(), recurrence: 'daily' });  // local date 2026-03-11 in Kiritimati (UTC+14), 2026-03-09 in Pago_Pago (UTC-11)
  vi.setSystemTime(new Date('2026-03-12T01:00:00Z'));                   // local today: 2026-03-12 in Kiritimati, 2026-03-11 in Pago_Pago
  const expected = (card: StreakCard) => card.cells.filter((c) => c.state !== 'not_expected').length;
  const kiritimati = (await streak.list(driver, 5, 'Pacific/Kiritimati'))[0];
  const pago = (await streak.list(driver, 5, 'Pacific/Pago_Pago'))[0];
  expect(kiritimati.cells.at(-1)!.date).toBe('2026-03-12');
  expect(pago.cells.at(-1)!.date).toBe('2026-03-11');
  expect(expected(kiritimati)).toBe(2);   // 03-11, 03-12
  expect(expected(pago)).toBe(3);         // 03-09, 03-10, 03-11
});
// idea.spec.ts  (case-insensitive tag matching within one user is already covered by the ported spec; it must pass on the new SQL)
it('lets two users own the same tag name', async () => {
  await idea_.create(driver, { title: 'a', note: null, tagNames: ['cs'] });
  await t.useUser(randomUUID());
  const b = await idea_.create(driver, { title: 'b', note: null, tagNames: ['CS'] });
  expect(b.tags.map((x) => x.name)).toEqual(['CS']);
});
it("refuses to promote an idea into another user's goal", async () => {
  const mine = await goal.create(driver, goalInput());
  await t.useUser(randomUUID());
  const idea = await idea_.create(driver, { title: 'x', note: null, tagNames: [] });
  await expect(idea_.promote(driver, idea.id, mine.id)).rejects.toMatchObject({ kind: 'not_found' });
});
// visionItem.spec.ts
it("ignores another user's ids when reordering", async () => {
  const me = t.userId;
  const other = randomUUID();
  const mine = await visionItem.create(driver, { imagePath: null, quoteText: 'mine' });
  await t.useUser(other);
  const theirs = await visionItem.create(driver, { imagePath: null, quoteText: 'theirs' });
  await t.useUser(me);
  await visionItem.reorder(driver, [theirs.id, mine.id]);       // theirs.id matches no row visible to me
  expect((await visionItem.get(driver, mine.id)).position).toBe(1);
  await t.useUser(other);
  expect((await visionItem.get(driver, theirs.id)).position).toBe(0);
});
```

  (`expectedCount` = count of cells whose state is not `'not_expected'`; pick fixture dates so the two counts differ, and assert the concrete numbers once you have run it.)
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Port.**

| File | Change |
|---|---|
| `streak.ts` | `list`, `setCompletion`, private `build`: take `tz`; `todayFn()` → `todayFn(tz)`; `localDateOf(habit.createdAt)` → `localDateOf(habit.createdAt, tz)`; pass `tz` through `task.listRecurring` (unchanged signature). |
| `completion.ts` | None. Its `ON CONFLICT (task_id, completed_on) DO NOTHING` is already Postgres syntax. |
| `idea.ts` | `resolveTagId`: `WHERE name = ?1 COLLATE NOCASE` → `WHERE lower(name) = lower(?1)`; insert gets `RETURNING id`. `setTags`: `INSERT OR IGNORE INTO idea_tag_links (…)` → `INSERT INTO idea_tag_links (…) VALUES (?1, ?2) ON CONFLICT DO NOTHING`. `list` tag filter: `t.name = ?N COLLATE NOCASE` → `lower(t.name) = lower(?N)`. `create`: `RETURNING id` on the `ideas` insert. `promote`: before the `UPDATE`, call `goal.ensureExists(driver, goalId)` (import from `./goal`) so a foreign key never accepts a goal the caller cannot see. |
| `visionItem.ts` | `create`: `RETURNING id`. In the `reorder` doc comment, drop the "no transaction primitive" caveat (the request transaction makes it atomic). |

- [ ] **Step 5: Run** `npm test && npm run check`. Expected: pass. Commit `feat(server): port streak, completion, idea and vision repos`.

---

## Task 8: Token verifier and app skeleton

**Files:**
- Create: `server/src/auth.ts`, `server/src/auth.spec.ts`, `server/src/http.ts`, `server/src/app.ts`, `server/src/app.spec.ts`, `server/src/testSupport/auth.ts`, `server/src/images.ts` (only the `ImageStore` interface and `createMemoryImageStore` for now; Task 10 adds the Supabase store and helpers)

**Interfaces:**
- Produces:

```ts
// images.ts (this task)
export interface ImageStore {
  put(userId: string, bytes: Uint8Array, contentType: string): Promise<string>;       // returns <userId>/<uuid>.<ext>
  remove(path: string): Promise<void>;                                                  // no-op if missing
  signedUrls(paths: string[], expiresInSeconds: number): Promise<(string | null)[]>;   // same order as paths
}
export function createMemoryImageStore(): ImageStore & { objects: Map<string, Uint8Array> };

// auth.ts
export type Verifier = (authorization: string | undefined) => Promise<{ userId: string }>;
export function createVerifier(opts: { getKey: JWTVerifyGetKey; issuer: string; audience: string }): Verifier;
// testSupport/auth.ts
export interface TestIdentity { getKey: JWTVerifyGetKey; issuer: string; audience: string; sign(claims?: { sub?: string; iss?: string; aud?: string; expiresIn?: string }): Promise<string> }
export function createTestIdentity(): Promise<TestIdentity>;
// http.ts
export interface Ctx { userId: string; tz: string; id(name?: string): number; body<T>(): T; query: Request['query'] }
export type Handle = <T>(
  fn: (driver: SqlDriver, ctx: Ctx) => Promise<T>,
  opts?: { status?: number; afterCommit?: (result: T) => Promise<void> }   // afterCommit runs after COMMIT; its failure is logged, never sent to the client
) => RequestHandler;
export function makeHandle(pool: Pool): Handle;
export function authenticate(verify: Verifier): RequestHandler;
export const errorHandler: ErrorRequestHandler;
// app.ts
export interface Deps { pool: Pool; verify: Verifier; images: ImageStore }
export function createApp(deps: Deps): Express;
```

  Precondition for production: the Supabase project must be using **asymmetric JWT signing keys** (JWKS). The verifier accepts only `ES256`/`RS256`, so a legacy HS256 shared-secret project fails closed (and prevents algorithm confusion).

- [ ] **Step 1: Write the failing tests.**

`testSupport/auth.ts` generates an ES256 key pair with `jose.generateKeyPair`, exposes `getKey: async () => publicKey`, and `sign()` builds a JWT with `new SignJWT({}).setProtectedHeader({alg:'ES256'}).setSubject(sub).setIssuer(iss).setAudience(aud).setExpirationTime(expiresIn).sign(privateKey)` (defaults: random uuid sub, issuer `https://test.supabase.co/auth/v1`, audience `authenticated`, `1h`).

`auth.spec.ts`:

```ts
it('accepts a valid token and returns the user id', ...);
it.each([
  ['no header', undefined],
  ['wrong scheme', 'Basic abc'],
  ['garbage', 'Bearer not.a.jwt'],
])('rejects %s', async (_n, header) => {
  await expect(verify(header)).rejects.toMatchObject({ kind: 'unauthenticated' });
});
it('rejects an expired token', ...sign({ expiresIn: '-1m' })...);
it('rejects the wrong issuer', ...);
it('rejects the wrong audience', ...);
it('rejects a token signed by a different key', ...second identity signs, first verifies...);
it('rejects an HS256 token (algorithm confusion)', ...SignJWT with a symmetric secret...);
it('rejects a token whose sub is not a uuid', ...sign({ sub: 'admin' })...);
```

`app.spec.ts` (supertest against `createApp({ pool, verify, images: createMemoryImageStore() })`):

```ts
it('serves healthz without a token or a database connection', async () => {
  const connect = vi.spyOn(pool, 'connect');
  await request(app).get('/api/healthz').expect(200);
  expect(connect).not.toHaveBeenCalled();
});
it('rejects an unauthenticated data request before touching the database', async () => {
  const connect = vi.spyOn(pool, 'connect');
  const res = await request(app).get('/api/categories').expect(401);
  expect(res.body).toEqual({ kind: 'unauthenticated', message: expect.any(String) });
  expect(connect).not.toHaveBeenCalled();
});
it('answers 404 JSON for unknown routes', ...);
it('answers 400 for malformed JSON', async () => {
  await auth(request(app).post('/api/categories')).set('Content-Type','application/json').send('{oops').expect(400)
    .expect((r) => expect(r.body.kind).toBe('validation'));
});
it('never leaks internal error text', ...mount a throwing test route via app.get...  expect body {kind:'internal',message:'internal error'}...);
```

  (The throwing test route is added in the spec through a small exported `createApp` option or by building a second `express()` with `errorHandler`; pick whichever needs no production hook, e.g. `express().get('/boom', () => { throw new Error('secret sql') }).use(errorHandler)`.)
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement `auth.ts`.**

```ts
const BEARER = /^Bearer (.+)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createVerifier({ getKey, issuer, audience }: {...}): Verifier {
  return async (authorization) => {
    const token = BEARER.exec(authorization ?? '')?.[1];
    if (!token) throw AppError.unauthenticated('missing bearer token');
    try {
      const { payload } = await jwtVerify(token, getKey, { issuer, audience, algorithms: ['ES256', 'RS256'] });
      if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) throw new Error('bad subject');
      return { userId: payload.sub };
    } catch {
      throw AppError.unauthenticated('invalid or expired token');
    }
  };
}
```

- [ ] **Step 4: Implement `http.ts`.**
  - `authenticate(verify)`: `async (req, res, next) => { res.locals.userId = (await verify(req.header('authorization'))).userId; next(); }` (Express 5 forwards the rejection).
  - `makeHandle(pool)` returns `handle(fn, { status = 200 } = {})`: builds `ctx` per request — `tz` is a getter that calls `parseTimezone(req.header('x-timezone'))` (so routes that never read it never require it); `id(name = 'id')` parses `req.params[name]` as a positive safe integer else `AppError.validation('invalid id')`; `body<T>()` returns `req.body` only if it is a non-null, non-array object else `AppError.validation('request body must be a JSON object')`. Runs `withUser(pool, res.locals.userId, (driver) => fn(driver, ctx))`; on success `status === 204 ? res.status(204).end() : res.status(status).json(result)`.
  - `errorHandler`: status map `{ validation: 400, unauthenticated: 401, not_found: 404, database: 500, internal: 500, unavailable: 503 }`.
    1. `AppError` → its status and `{ kind, message }`, except kind `database`/`internal`, whose message is replaced by `'internal error'` (log the original with `console.error`).
    2. body-parser errors (`err.type === 'entity.parse.failed'`, `'entity.too.large'`) and `multer.MulterError` → 400 validation with a generic message.
    3. Postgres errors (`typeof err.code === 'string'`): SQLSTATE class `22` or `23` → 400 `{ kind: 'validation', message: 'invalid value' }`, except `23505` → `'that value already exists'`; everything else → 500.
    4. Anything else → log, 500 `{ kind: 'internal', message: 'internal error' }`.
- [ ] **Step 5: Implement `app.ts`.** `const app = express(); app.disable('x-powered-by'); const api = Router(); api.get('/healthz', …200 {status:'ok'}); api.get('/readyz', async (_req,res) => { await pool.query('SELECT 1'); res.json({status:'ready'}); }); api.use(express.json({ limit: '1mb' })); api.use(authenticate(verify)); /* routers mounted in Tasks 9-10 */ api.use((_req,_res,next) => next(new AppError('not_found','no such route'))); app.use('/api', api); app.use(errorHandler); return app;` Note: `/readyz` must work for the readiness probe with the **app role**, so use `pool.query` (not owner).
- [ ] **Step 6: Run** `npm test && npm run check`. Expected: pass. Commit `feat(server): token verifier and app skeleton`.

---

## Task 9: Routes for every data group

**Files:**
- Create: `server/src/routes/{categories,goals,subgoals,tasks,streaks,ideas,visionItems,settings}.ts`, `server/src/routes/routes.spec.ts`, `server/src/testSupport/client.ts`
- Modify: `server/src/app.ts` (mount routers after `authenticate`)

**Interfaces:**
- Each router file exports `xxxRouter(handle: Handle): Router`. `testSupport/client.ts`: `export function clientFor(app: Express, token: string)` returning `{ get, post, put, delete }(path)` supertest requests pre-set with `Authorization: Bearer <token>` and `X-Timezone: UTC`.
- Route table (all under `/api`; JSON bodies are the existing input types; every success is 200 JSON except deletes, which are 204 with no body):

| Method + path | Calls |
|---|---|
| `GET /categories` · `POST /categories` · `PUT /categories/:id` · `DELETE /categories/:id` | `category.list/create/update/remove` |
| `GET /goals?status=` (tz) · `GET /goals/:id` (tz) · `POST /goals` · `PUT /goals/:id` · `PUT /goals/:id/status` `{status}` · `DELETE /goals/:id?deleteOrphanedTasks=true` | `goal.*`; `status` query must be one of `active|completed|archived`; missing `deleteOrphanedTasks` means `false` |
| `GET /subgoals` · `POST /subgoals` · `PUT /subgoals/:id` · `PUT /subgoals/:id/complete` `{isComplete}` · `DELETE /subgoals/:id` | `subgoal.*` |
| `GET /tasks` (tz) · `POST /tasks` · `PUT /tasks/:id` · `PUT /tasks/:id/status` `{status}` · `DELETE /tasks/:id` | `task.*` |
| `GET /streaks?days=` (tz) · `PUT /tasks/:id/completion` `{done, date?}` (tz) | `streak.list/setCompletion`; `days` default `DEFAULT_CELL_DAYS`, integer 1-366; missing `date` means `null` (today) |
| `GET /ideas?tag=&includePromoted=` · `GET /ideas/:id` · `POST /ideas` · `PUT /ideas/:id` · `DELETE /ideas/:id` · `POST /ideas/:id/promote` `{goalId}` · `GET /idea-tags` | `idea.*` |
| `GET /vision-items` · `POST /vision-items` · `PUT /vision-items/order` `{orderedIds}` · `PUT /vision-items/:id` · `DELETE /vision-items/:id` | `visionItem.*` (`/order` registered before `/:id`; image handling added in Task 10) |
| `GET /settings` · `PUT /settings/theme` `{theme}` · `PUT /settings/streak-grace-days` `{days}` | `settings.*` |

  "(tz)" routes read `ctx.tz`; no other route requires `X-Timezone`.

- [ ] **Step 1: Write the failing tests** in `routes.spec.ts`. Setup: one `createTestIdentity()`, users `A` and `B` (random uuids, tokens from `sign({sub})`), `afterAll` → `purgeUsers([A, B])` and `pool.end()`. Tests:

```ts
const groups = [
  { name: 'categories', path: '/api/categories', create: { name: 'Hobbies', colorToken: null }, update: { name: 'Crafts', colorToken: null } },
  { name: 'ideas', path: '/api/ideas', create: { title: 'Idea', note: null, tagNames: ['x'] }, update: { title: 'Idea 2', note: 'n', tagNames: [] } },
  { name: 'vision-items', path: '/api/vision-items', create: { imagePath: null, quoteText: 'Go' }, update: { imagePath: null, quoteText: 'Go on' } },
  { name: 'goals', path: '/api/goals', create: goalBody, update: { ...goalBody, title: 'Renamed' } },
  { name: 'tasks', path: '/api/tasks', create: taskBody, update: { ...taskBody, status: 'in_progress' } },
];
describe.each(groups)('$name', (g) => {
  it('supports create, read, update and delete for its owner', async () => {
    const created = (await a.post(g.path).send(g.create).expect(200)).body;
    expect((await a.get(g.path).expect(200)).body.map((x: any) => x.id)).toContain(created.id);
    const updated = (await a.put(`${g.path}/${created.id}`).send(g.update).expect(200)).body;
    expect(updated.id).toBe(created.id);
    await a.delete(`${g.path}/${created.id}`).expect(204);
    expect((await a.get(g.path).expect(200)).body.map((x: any) => x.id)).not.toContain(created.id);
  });
  it("hides the owner's records from other users", async () => {
    const created = (await a.post(g.path).send(g.create).expect(200)).body;
    expect((await b.get(g.path).expect(200)).body.map((x: any) => x.id)).not.toContain(created.id);
    await b.put(`${g.path}/${created.id}`).send(g.update).expect(404);
    await b.delete(`${g.path}/${created.id}`).expect(404);
  });
});
```

  Plus targeted tests: `subgoals` (create under A's goal; B gets 404 creating under it; toggle `/complete`); `goals` (`GET /goals/:id` as B → 404; `PUT /status`; `DELETE ?deleteOrphanedTasks=true` removes the goal's subgoal-tasks, `false` keeps them as standalone); `tasks` (`PUT /status`; B creating with A's `goalId` → 404); `streaks` (create a daily habit, `PUT /tasks/:id/completion {done:true}` then `GET /streaks` shows `doneToday`; missing `X-Timezone` on `GET /streaks` → 400; `GET /tasks` without the header → 400); `ideas` (promote; `GET /idea-tags`; promote into B's goal id → 404); `vision-items` (`PUT /order` reorders A's list; B's ids in `orderedIds` don't move B's items); `settings` (theme to `coquette`, bogus theme → 400, grace days 8 → 400); and hostile bodies (Review Focus 7):

```ts
it.each([
  ['non-text title', '/api/goals', { ...goalBody, title: 123 }],
  ['missing body fields', '/api/goals', {}],
  ['bad enum', '/api/goals', { ...goalBody, timeframe: 'bogus' }],
  ['non-numeric foreign key', '/api/tasks', { ...taskBody, goalId: 'abc' }],
  ['array body', '/api/categories', [1, 2]],
])('rejects %s with 400 and no SQL text', async (_n, path, body) => {
  const res = await a.post(path).send(body).expect(400);
  expect(res.body.kind).toBe('validation');
  expect(JSON.stringify(res.body)).not.toMatch(/violates|syntax|relation|column/i);
});
it('rejects non-numeric ids with 400', async () => { await a.get('/api/goals/abc').expect(400); });
```

  (`goalBody`/`taskBody` are complete valid inputs: `{categoryId:null,title:'G',description:null,timeframe:'mid',dueDate:null,motivationText:null,motivationImagePath:null,repoUrl:null}` and `{title:'T',dueDate:null,goalId:null,subgoalId:null,recurrence:null}`.)
- [ ] **Step 2: Run** → FAIL (404s).
- [ ] **Step 3: Implement the routers.** Pattern (write the other seven the same way):

```ts
// routes/categories.ts
export function categoriesRouter(handle: Handle): Router {
  const r = Router();
  r.get('/', handle((db) => category.list(db)));
  r.post('/', handle((db, c) => category.create(db, c.body<CategoryInput>())));
  r.put('/:id', handle((db, c) => category.update(db, c.id(), c.body<CategoryInput>())));
  r.delete('/:id', handle((db, c) => category.remove(db, c.id()), { status: 204 }));
  return r;
}
```

  Mount in `app.ts` after `authenticate`: `api.use('/categories', categoriesRouter(handle))`, and so on for each prefix. Two routes live outside their module's prefix: `GET /idea-tags` is registered directly with `api.get('/idea-tags', handle(...))`, and the streak module exports a router mounted at `/` that serves both `GET /streaks` and `PUT /tasks/:id/completion` (no clash with the tasks router, whose paths are `/`, `/:id` and `/:id/status`).
- [ ] **Step 4: Run** `npm test && npm run check`. Expected: pass. Commit `feat(server): data routes`.

---

## Task 10: Image store and vision image routes

**Files:**
- Create: `server/src/images.spec.ts`, `server/src/routes/visionImages.ts`
- Modify: `server/src/images.ts` (Task 8 created the interface and memory store), `server/src/routes/visionItems.ts`, `server/src/app.ts`, `server/src/routes/routes.spec.ts` (vision cases)

**Interfaces:**
- Produces (added to `images.ts`; `ImageStore` and `createMemoryImageStore` already exist from Task 8):

```ts
export function createSupabaseImageStore(opts: { url: string; serviceKey: string; bucket: string; fetch?: typeof fetch }): ImageStore;
export function sniffImageType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | null;
export function isOwnImagePath(userId: string, path: string): boolean;
```

  Routes: `POST /api/vision-images` (multipart field `file`) → `{ imagePath, imageUrl }`. Vision item responses become `VisionItemView` (`imageUrl` signed for 3600 s, `null` without an image). `imagePath` on create/update must satisfy `isOwnImagePath`.

- [ ] **Step 1: Write the failing tests.**

```ts
// images.spec.ts
const PNG = Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a, 0,0,0,0]);
it('recognises png, jpeg, webp and gif by their first bytes', ...);
it('returns null for text, svg and empty input', ...);
it('accepts only <ownUuid>/<uuid>.<ext> paths', () => {
  const me = randomUUID(), other = randomUUID(), file = randomUUID();
  expect(isOwnImagePath(me, `${me}/${file}.png`)).toBe(true);
  expect(isOwnImagePath(me, `${other}/${file}.png`)).toBe(false);
  expect(isOwnImagePath(me, `${me}/../${other}/${file}.png`)).toBe(false);
  expect(isOwnImagePath(me, `${me}/${file}.svg`)).toBe(false);
});
it('memory store round-trips put, signedUrls and remove', ...);

// routes.spec.ts additions (memory store injected)
it('uploads an image and returns a path and a signed url', async () => {
  const res = await a.post('/api/vision-images').attach('file', Buffer.from(PNG), { filename: 'a.png', contentType: 'image/png' }).expect(200);
  expect(res.body.imagePath).toMatch(new RegExp(`^${A}/[0-9a-f-]{36}\\.png$`));
  expect(res.body.imageUrl).toEqual(expect.any(String));
});
it.each([
  ['wrong declared type', Buffer.from(PNG), 'a.txt', 'text/plain'],
  ['declared png but not an image', Buffer.from('hello world!'), 'a.png', 'image/png'],
  ['svg', Buffer.from('<svg/>'), 'a.svg', 'image/svg+xml'],
])('rejects %s', async (_n, buf, filename, contentType) => {
  await a.post('/api/vision-images').attach('file', buf, { filename, contentType }).expect(400);
});
it('rejects an empty upload and a request with no file', ...400...);
it('rejects files over 5 MB', async () => {
  await a.post('/api/vision-images').attach('file', Buffer.concat([Buffer.from(PNG), Buffer.alloc(5 * 1024 * 1024)]), { filename: 'big.png', contentType: 'image/png' }).expect(400);
});
it("rejects another user's image path on a vision item", async () => {
  await a.post('/api/vision-items').send({ imagePath: `${B}/${randomUUID()}.png`, quoteText: null }).expect(400);
});
it('removes the old object when an item\'s image is replaced or the item is deleted', ...check store.objects...);
it('returns imageUrl on listed items', ...);
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement `images.ts`.** `sniffImageType` checks magic bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, GIF `GIF87a`/`GIF89a`, WebP `RIFF....WEBP`). `isOwnImagePath`: `new RegExp(\`^${userId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(png|jpg|webp|gif)$\`, 'i')` built only after `userId` has matched the uuid pattern. Supabase store (Storage REST, authenticated with `Authorization: Bearer <serviceKey>` and `apikey: <serviceKey>` — **confirm each endpoint against the current Supabase Storage API docs while implementing**):
  - `put`: `POST {url}/storage/v1/object/{bucket}/{path}` with `Content-Type` = the sniffed type and `x-upsert: false`; non-2xx → throw `AppError('unavailable', 'image storage failed')`.
  - `signedUrls`: `POST {url}/storage/v1/object/sign/{bucket}` with JSON `{ expiresIn, paths }`; each result's `signedURL` is joined as `{url}/storage/v1{signedURL}`; failed entries → `null`. Empty `paths` → `[]` without a request.
  - `remove`: `DELETE {url}/storage/v1/object/{bucket}` with JSON `{ prefixes: [path] }`.
  Unit-test the Supabase store with a stubbed `fetch` (inject via an optional `fetch` field in `opts`) asserting URL, method, headers and body for each call.
- [ ] **Step 4: Implement the routes.**
  - `visionImages.ts`: `multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file')` (a `MulterError` reaches `errorHandler` → 400). Handler: no file or `size === 0` → `AppError.validation('choose an image to upload')`; `type = sniffImageType(file.buffer)`; null, or not equal to the declared mimetype, → `AppError.validation('unsupported image')`; `imagePath = await images.put(userId, bytes, type)`; respond `{ imagePath, imageUrl }` from `signedUrls([imagePath], 3600)[0]`. This route does not use `handle` (no database), but must sit after `authenticate`.
  - `visionItems.ts`: wrap list/create/update responses with `withUrls(items)` (one `signedUrls` call for the whole list). Create/update: when `imagePath` is non-null require `isOwnImagePath(ctx.userId, imagePath)` else `AppError.validation('invalid image path')`. Update: read the existing item first; the handler's result carries the old `imagePath` when it was replaced or cleared. Delete: read the item, delete the row, and carry its `imagePath`. Both pass an `afterCommit` that calls `images.remove(oldPath)` (Task 8's `Handle` option), so an object is only removed once the row change is durable; a failed removal is logged and leaves an unreferenced object, never a row pointing at nothing. (This deliberately reverses the desktop order, which had no transaction to roll back.)
- [ ] **Step 5: Run** `npm test && npm run check`. Expected: pass. Commit `feat(server): vision image upload and signed urls`.

---

## Task 11: Entry point, config and container image

**Files:**
- Create: `server/src/config.ts`, `server/src/config.spec.ts`, `server/src/main.ts`, `server/Dockerfile`, `server/README.md`

**Interfaces:**
- Produces:

```ts
export interface Config { databaseUrl: string; supabaseUrl: string; supabaseServiceKey: string; port: number; imageBucket: string }
export function loadConfig(env: NodeJS.ProcessEnv): Config;
```

- [ ] **Step 1: Write the failing test** `config.spec.ts`:

```ts
it('lists every missing variable at once', () => {
  expect(() => loadConfig({})).toThrow('missing environment variables: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY');
});
it('defaults the port to 3000 and the bucket to vision', () => {
  const c = loadConfig({ DATABASE_URL: 'd', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k' });
  expect(c).toMatchObject({ port: 3000, imageBucket: 'vision' });
});
it('strips a trailing slash from SUPABASE_URL', ...);
it('rejects a non-numeric PORT', ...);
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement `config.ts`** per the tests.
- [ ] **Step 4: Implement `main.ts`.**

```ts
const config = loadConfig(process.env);
const pool = createPool(config.databaseUrl);
const verify = createVerifier({
  getKey: createRemoteJWKSet(new URL(`${config.supabaseUrl}/auth/v1/.well-known/jwks.json`)),
  issuer: `${config.supabaseUrl}/auth/v1`,
  audience: 'authenticated'
});
const images = createSupabaseImageStore({ url: config.supabaseUrl, serviceKey: config.supabaseServiceKey, bucket: config.imageBucket });
const server = createApp({ pool, verify, images }).listen(config.port, () => console.log(`api listening on ${config.port}`));
process.on('SIGTERM', () => server.close(() => void pool.end()));
```

- [ ] **Step 5: Dockerfile.**

```dockerfile
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

  (`.dockerignore`: `node_modules`, `dist`, `.env`, `src/**/*.spec.ts`, `src/testSupport`, `test`.) The same image runs migrations with command `node dist/db/migrateCli.js`.
- [ ] **Step 6: Verify the image.**
  1. `npm run db:up && npm run migrate` (applies schema to the compose database).
  2. `docker build -t mushpoint-api server`.
  3. `docker run --rm -d --name mp-api --network host -e DATABASE_URL=postgres://mushpoint_app:mushpoint_app@localhost:54329/postgres -e SUPABASE_URL=https://example.supabase.co -e SUPABASE_SERVICE_KEY=dummy -e PORT=3000 mushpoint-api`
  4. `curl -s localhost:3000/api/healthz` → `{"status":"ok"}`; `curl -s localhost:3000/api/readyz` → `{"status":"ready"}`; `curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/goals` → `401`.
  5. `docker stop mp-api`. (On Docker Desktop for macOS replace `localhost` in `DATABASE_URL` with `host.docker.internal` and drop `--network host`, publishing `-p 3000:3000` instead.)
- [ ] **Step 7: Document and commit.** `server/README.md`: prerequisites, the six commands (`db:up`, `migrate`, `test`, `check`, `dev`, `build`), env var table, and the Supabase precondition (asymmetric signing keys, private `vision` bucket). Commit `feat(server): entry point, config and container image`.
- [ ] **Step 8 (optional manual smoke, needs a Supabase project):** create a project with "Confirm email" on, asymmetric JWT signing keys, private bucket `vision`; sign up and log in with any Supabase client to obtain an access token; run the API with real `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`; `curl -H "Authorization: Bearer $TOKEN" -H "X-Timezone: America/New_York" localhost:3000/api/goals` → `[]`; `GET /api/categories` → the five defaults. Record any deviation (e.g. a Storage endpoint that differs from Task 10's assumptions) in `server/README.md`.

---

## Phase 1 exit check

- [ ] `cd server && npm run db:down && npm run db:up && npm test` — all green from a clean database.
- [ ] `npm run check` — no type errors.
- [ ] `npm run build` produces `dist/main.js`, `dist/db/migrateCli.js` and `dist/db/migrations/0001_init.sql`.
- [ ] Task 11 container verification passes.
- [ ] `git status` shows no changes under `app/`.
- [ ] Every Review Focus line above can be pointed at a passing test.

## Self-review notes

- **Spec coverage:** per-user data and RLS (Tasks 2, 3, 6, 7, 9); API under bearer token with JWKS (8, 11); timezone from `X-Timezone` (5-8); images with signed URLs and ownership checks (10); Postgres-only port with shared types (4, 6, 7); container image reusable as the migration Job (11). Web client, Supabase browser auth and Kubernetes are Phases 2 and 3.
- **Deviations from the outline, deliberate:** timezone is threaded through task/subgoal/goal lists as well as streaks (the originals compute "today" in those too); `idea.promote` gained an existence check; category names stay case-sensitive as in the original; upload responses include `imageUrl`; builds use esbuild so copied code keeps extensionless imports; `signedUrls` is batched.
- **Names used across tasks:** `createPool`, `migrate`, `withUser`, `bootstrapUser`, `createPgDriver`, `toPg`, `createTestDb`/`TestDb`/`TEST_TZ`/`purgeUsers`, `createVerifier`/`Verifier`, `createTestIdentity`, `Handle`/`makeHandle`/`Ctx`, `errorHandler`, `createApp`/`Deps`, `ImageStore`, `isOwnImagePath`, `sniffImageType`, `loadConfig`.
