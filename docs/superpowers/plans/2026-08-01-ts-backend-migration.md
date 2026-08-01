# Backend Migration — Rust to TypeScript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all Mushpoint backend logic (SQL repositories, progress math, streak math) from Rust into TypeScript, leaving Rust responsible only for SQLite schema migrations and Tauri plugin registration.

**Architecture:** `@tauri-apps/plugin-sql` gives TypeScript direct SQL access to the same `mushpoint.sqlite3` file the app uses today. A thin `SqlDriver` interface (`select`/`execute`) decouples repo code from the concrete driver, so repo logic is unit-testable against Node's built-in `node:sqlite` without a running Tauri app, while the real app uses the plugin-backed driver. `app/src/lib/api/*` keeps its exact exported signatures throughout, so no Svelte route or component changes.

**Tech Stack:** TypeScript, `@tauri-apps/plugin-sql` (JS + Rust), `node:sqlite` (`DatabaseSync`, Node 24 built-in, test-only), vitest, existing Playwright suite.

**Spec:** `docs/superpowers/specs/2026-08-01-ts-backend-migration-design.md`

## Global Constraints

- Big-bang cutover: old Rust commands keep working until Task 17 flips `api/index.ts`/`api/settings.ts`; nothing is deleted until Task 18.
- SQL placeholders are numbered and positional — `?1`, `?2`, ... — matching today's `rusqlite` code exactly, ported verbatim. Verified against both `node:sqlite` (empirically, see Task 2 note) and relied upon for `tauri-plugin-sql` via sqlx's index-based bind semantics (sqlx binds by call order regardless of placeholder spelling for SQLite) — confirmed end-to-end in Task 2 before any repo file is ported.
- Every boolean value bound into a query must be passed as `Number(value)` (`0`/`1`), never a raw JS `boolean` — `node:sqlite` rejects raw booleans outright (verified), and there's no reason to assume the plugin-sql path is more lenient.
- All dates are plain `YYYY-MM-DD` strings end to end (no `Date`/`NaiveDate` object threaded through repo code) — arithmetic goes through `db/logic/dates.ts`, never native `Date` methods with local-timezone semantics.
- `db/repo/*.ts` functions take an `SqlDriver` as their first parameter, exactly mirroring how the Rust functions took `&Connection` first.
- Function names change one way on purpose: Rust's `delete(...)` becomes `remove(...)` everywhere (`delete` is a reserved word in JS).
- Money/format details aside, every `#[cfg(test)]` case in `streak.rs`, `progress.rs`, and `repo/*.rs` gets a corresponding vitest case with the same fixture values — this plan lists every one.

---

### Task 1: Register `tauri-plugin-sql` in Rust, additive only

**Files:**
- Modify: `app/src-tauri/Cargo.toml`
- Modify: `app/src-tauri/src/lib.rs`
- Modify: `app/src-tauri/capabilities/default.json`

**Interfaces:**
- Produces: a working SQLite connection reachable from JS at `sqlite:mushpoint.sqlite3`, migrated to the same schema the app has today, alongside the still-functioning old Rust commands.

- [ ] **Step 1: Add the dependency**

Run from `app/src-tauri/`:

```bash
cargo add tauri-plugin-sql --features sqlite
```

This appends a `tauri-plugin-sql = { version = "...", features = ["sqlite"] }` line to `Cargo.toml` — don't hand-type a version, let `cargo add` resolve the current one.

- [ ] **Step 2: Register the plugin with the ported migrations**

Edit `app/src-tauri/src/lib.rs`. Keep every existing line (old commands keep running); add the plugin registration and a `migrations()` function above `run()`:

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

/// Connection string shared with the JS side (`app/src/lib/db/connection.ts`) —
/// tauri-plugin-sql keys registered migrations by this exact string, so it must
/// match on both sides verbatim.
const SQL_CONNECTION: &str = "sqlite:mushpoint.sqlite3";

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "streaks",
            sql: include_str!("../migrations/0002_streaks.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
```

Create `app/src-tauri/migrations/0001_initial.sql` with exactly the contents of `M0001_INITIAL` from `app/src-tauri/src/db/migrations.rs` (the string between the `r#"` and `"#` delimiters, unchanged).

Create `app/src-tauri/migrations/0002_streaks.sql` with exactly the contents of `M0002_STREAKS` from the same file.

In `run()`, add the plugin to the builder chain, before `.invoke_handler(...)`:

```rust
tauri::Builder::default()
    .plugin(
        tauri_plugin_sql::Builder::default()
            .add_migrations(SQL_CONNECTION, migrations())
            .build(),
    )
    .setup(|app| {
        // ...unchanged...
    })
    .invoke_handler(command_handlers!())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

- [ ] **Step 3: Add SQL permissions**

Edit `app/src-tauri/capabilities/default.json`:

```json
{
	"$schema": "../gen/schemas/desktop-schema.json",
	"identifier": "default",
	"description": "enables the default permissions",
	"windows": ["main"],
	"permissions": ["core:default", "sql:default", "sql:allow-execute"]
}
```

- [ ] **Step 4: Verify it builds**

Run: `cargo build --manifest-path app/src-tauri/Cargo.toml`
Expected: builds clean. The old `rusqlite`-backed commands and the new plugin now coexist.

- [ ] **Step 5: Commit**

```bash
git add app/src-tauri/Cargo.toml app/src-tauri/Cargo.lock app/src-tauri/src/lib.rs app/src-tauri/capabilities/default.json app/src-tauri/migrations
git commit -m "feat: register tauri-plugin-sql alongside the existing Rust commands"
```

---

### Task 2: Verify the plugin-sql path end-to-end before porting anything

This is a manual gate, not an automated test — it exists to catch a wrong assumption (numbered `?1` placeholders working against the real plugin) before Tasks 9–16 port a few thousand lines under that assumption.

**Files:** none (no code changes — delete the scratch line before moving on)

- [ ] **Step 1: Add a throwaway probe**

Temporarily add this to the top of `app/src/routes/+layout.svelte`'s `<script>` block (or run it from the browser devtools console once the app is open — either works):

```ts
import Database from '@tauri-apps/plugin-sql';
const probe = await Database.load('sqlite:mushpoint.sqlite3');
const rows = await probe.select('SELECT ?1 as one WHERE ?1 = ?2', [1, 1]);
console.log('plugin-sql probe:', rows);
```

- [ ] **Step 2: Run the real app and check the console**

Run: `npm run tauri dev` (from `app/`)
Expected: the console logs `plugin-sql probe: [{ one: 1 }]`. If it throws or returns nothing, stop — the numbered-placeholder assumption is wrong and every task from Task 9 onward needs its SQL rewritten to `?` or `$1` before continuing (rewrite `db/logic` is unaffected; only `db/repo/*.ts` SQL strings would need a placeholder-style change).

- [ ] **Step 3: Remove the probe**

Delete the lines added in Step 1. Nothing to commit — this task produces no lasting file changes.

---

### Task 3: `SqlDriver` interface and `AppError`

**Files:**
- Create: `app/src/lib/db/driver.ts`
- Create: `app/src/lib/db/error.ts`
- Test: `app/src/lib/db/error.spec.ts`

**Interfaces:**
- Produces: `SqlDriver` (`select<T>(sql, params?): Promise<T[]>`, `execute(sql, params?): Promise<QueryResult>`), `QueryResult { lastInsertId: number; rowsAffected: number }`, `AppError` class with `kind: ErrorKind`, `.isUserFixable`, `AppError.notFound(entity, id)`, `AppError.validation(message)`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/db/error.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AppError } from './error';

describe('AppError', () => {
	it('builds a not_found error with a standard message', () => {
		const err = AppError.notFound('goal', 404);
		expect(err.kind).toBe('not_found');
		expect(err.message).toBe('goal 404 not found');
	});

	it('builds a validation error verbatim', () => {
		const err = AppError.validation('title cannot be empty');
		expect(err.kind).toBe('validation');
		expect(err.message).toBe('title cannot be empty');
	});

	it('is user-fixable only for validation and not_found', () => {
		expect(AppError.notFound('goal', 1).isUserFixable).toBe(true);
		expect(AppError.validation('bad').isUserFixable).toBe(true);
		expect(new AppError('database', 'boom').isUserFixable).toBe(false);
		expect(new AppError('internal', 'boom').isUserFixable).toBe(false);
		expect(new AppError('unavailable', 'boom').isUserFixable).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/error.spec.ts`
Expected: FAIL — `./error` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/db/driver.ts`:

```ts
export interface QueryResult {
	lastInsertId: number;
	rowsAffected: number;
}

/** The one seam between repo code and a concrete SQLite backend — the real
 * plugin-sql connection in the app, node:sqlite in tests. */
export interface SqlDriver {
	select<T>(sql: string, params?: unknown[]): Promise<T[]>;
	execute(sql: string, params?: unknown[]): Promise<QueryResult>;
}
```

Create `app/src/lib/db/error.ts`:

```ts
export type ErrorKind = 'not_found' | 'validation' | 'database' | 'internal' | 'unavailable';

/** Every failure the UI can observe. Thrown directly by repo code — there is
 * no process boundary left to serialize across. */
export class AppError extends Error {
	readonly kind: ErrorKind;

	constructor(kind: ErrorKind, message: string) {
		super(message);
		this.name = 'AppError';
		this.kind = kind;
	}

	/** True when the user can fix it themselves by changing their input. */
	get isUserFixable() {
		return this.kind === 'validation' || this.kind === 'not_found';
	}

	static notFound(entity: string, id: number): AppError {
		return new AppError('not_found', `${entity} ${id} not found`);
	}

	static validation(message: string): AppError {
		return new AppError('validation', message);
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/error.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db/driver.ts app/src/lib/db/error.ts app/src/lib/db/error.spec.ts
git commit -m "feat: add SqlDriver interface and AppError"
```

---

### Task 4: In-memory test schema and `node:sqlite` test driver

**Files:**
- Create: `app/src/lib/db/testSchema.ts`
- Create: `app/src/lib/db/testDriver.ts`
- Test: `app/src/lib/db/testDriver.spec.ts`

**Interfaces:**
- Consumes: `SqlDriver` from `./driver` (Task 3).
- Produces: `createTestDriver(): SqlDriver`, backed by an in-memory `node:sqlite` database with the full schema applied. Every later repo test (Tasks 10–16) uses this.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/db/testDriver.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createTestDriver } from './testDriver';

describe('createTestDriver', () => {
	it('applies the schema and seeds default categories', async () => {
		const driver = createTestDriver();
		const rows = await driver.select<{ name: string }>(
			'SELECT name FROM categories ORDER BY id'
		);
		expect(rows.map((r) => r.name)).toEqual([
			'Work',
			'Gym',
			'School',
			'Side Projects',
			'Social'
		]);
	});

	it('binds numbered positional placeholders', async () => {
		const driver = createTestDriver();
		const rows = await driver.select<{ theme: string }>(
			'SELECT active_theme as theme FROM settings WHERE id = ?1',
			[1]
		);
		expect(rows[0].theme).toBe('nocturne');
	});

	it('reports lastInsertId and rowsAffected on execute', async () => {
		const driver = createTestDriver();
		const result = await driver.execute(
			'INSERT INTO categories (name, is_default, created_at) VALUES (?1, 0, ?2)',
			['Reading', new Date().toISOString()]
		);
		expect(result.rowsAffected).toBe(1);
		expect(result.lastInsertId).toBeGreaterThan(0);
	});

	it('enforces foreign keys with cascade deletes', async () => {
		const driver = createTestDriver();
		const now = new Date().toISOString();
		const goal = await driver.execute(
			"INSERT INTO goals (title, timeframe, created_at, updated_at) VALUES ('Ship v1', 'mid', ?1, ?1)",
			[now]
		);
		await driver.execute(
			"INSERT INTO subgoals (goal_id, title, created_at, updated_at) VALUES (?1, 'Write the schema', ?2, ?2)",
			[goal.lastInsertId, now]
		);
		await driver.execute('DELETE FROM goals WHERE id = ?1', [goal.lastInsertId]);
		const remaining = await driver.select('SELECT * FROM subgoals');
		expect(remaining).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/testDriver.spec.ts`
Expected: FAIL — `./testDriver` does not exist.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/db/testSchema.ts` — the same two migration bodies as `app/src-tauri/migrations/0001_initial.sql` and `0002_streaks.sql` from Task 1, concatenated as one TS string constant (this is the one accepted duplication point named in the spec — append-only DDL, low drift risk):

```ts
/** Mirrors app/src-tauri/migrations/0001_initial.sql + 0002_streaks.sql exactly.
 * Used only to build the in-memory schema for vitest; the real app applies
 * these same statements through the Rust plugin-sql migration registration in
 * src-tauri/src/lib.rs. Keep the two in sync when adding a migration. */
export const TEST_SCHEMA = `
CREATE TABLE categories (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL UNIQUE,
    color_token TEXT,
    is_default  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL
);

CREATE TABLE goals (
    id                    INTEGER PRIMARY KEY,
    category_id           INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    title                 TEXT    NOT NULL,
    description           TEXT,
    timeframe             TEXT    NOT NULL CHECK (timeframe IN ('short', 'mid', 'long')),
    status                TEXT    NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'completed', 'archived')),
    due_date              TEXT,
    motivation_text       TEXT,
    motivation_image_path TEXT,
    created_at            TEXT    NOT NULL,
    updated_at            TEXT    NOT NULL
);

CREATE INDEX idx_goals_category ON goals(category_id);
CREATE INDEX idx_goals_status ON goals(status);

CREATE TABLE subgoals (
    id          INTEGER PRIMARY KEY,
    goal_id     INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    title       TEXT    NOT NULL,
    due_date    TEXT,
    is_complete INTEGER NOT NULL DEFAULT 0,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
);

CREATE INDEX idx_subgoals_goal ON subgoals(goal_id);

CREATE TABLE tasks (
    id           INTEGER PRIMARY KEY,
    title        TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'todo'
                         CHECK (status IN ('todo', 'in_progress', 'done')),
    due_date     TEXT,
    goal_id      INTEGER REFERENCES goals(id) ON DELETE SET NULL,
    subgoal_id   INTEGER REFERENCES subgoals(id) ON DELETE SET NULL,
    recurrence   TEXT CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekdays', 'weekly')),
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL
);

CREATE INDEX idx_tasks_goal ON tasks(goal_id);
CREATE INDEX idx_tasks_subgoal ON tasks(subgoal_id);

CREATE TABLE settings (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    active_theme TEXT    NOT NULL DEFAULT 'nocturne',
    streak_grace_days INTEGER NOT NULL DEFAULT 2 CHECK (streak_grace_days BETWEEN 0 AND 7),
    updated_at   TEXT    NOT NULL
);

INSERT INTO settings (id, active_theme, updated_at)
VALUES (1, 'nocturne', datetime('now'));

INSERT INTO categories (name, color_token, is_default, created_at) VALUES
    ('Work',          'accent-primary',   1, datetime('now')),
    ('Gym',           'accent-secondary', 1, datetime('now')),
    ('School',        'accent-tertiary',  1, datetime('now')),
    ('Side Projects', 'accent-primary',   1, datetime('now')),
    ('Social',        'accent-secondary', 1, datetime('now'));

CREATE TABLE task_completions (
    id           INTEGER PRIMARY KEY,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    completed_on TEXT    NOT NULL,
    created_at   TEXT    NOT NULL,
    UNIQUE (task_id, completed_on)
);

CREATE INDEX idx_completions_task ON task_completions(task_id, completed_on);
`;
```

Note this collapses the Rust migration's two-step `ADD COLUMN` / backfill / `DROP COLUMN` dance for `recurrence` into the final shape directly, since the in-memory test database is always created fresh at the final schema version — there's no upgrade path to replay in tests.

Create `app/src/lib/db/testDriver.ts`:

```ts
import { DatabaseSync } from 'node:sqlite';
import type { QueryResult, SqlDriver } from './driver';
import { TEST_SCHEMA } from './testSchema';

/** A fresh in-memory SQLite database per call, migrated to the current schema.
 * Built on node:sqlite's DatabaseSync (Node 24+, no native build step) rather
 * than better-sqlite3, which failed to compile in this environment. */
export function createTestDriver(): SqlDriver {
	const db = new DatabaseSync(':memory:');
	db.exec('PRAGMA foreign_keys = ON;');
	db.exec(TEST_SCHEMA);

	return {
		select: async <T>(sql: string, params: unknown[] = []) =>
			db.prepare(sql).all(...params) as T[],
		execute: async (sql: string, params: unknown[] = []): Promise<QueryResult> => {
			const result = db.prepare(sql).run(...params);
			return {
				lastInsertId: Number(result.lastInsertRowid),
				rowsAffected: Number(result.changes)
			};
		}
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/testDriver.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db/testSchema.ts app/src/lib/db/testDriver.ts app/src/lib/db/testDriver.spec.ts
git commit -m "feat: add in-memory node:sqlite test driver"
```

---

### Task 5: Real plugin-sql driver and connection singleton

**Files:**
- Create: `app/src/lib/db/pluginSqlDriver.ts`
- Create: `app/src/lib/db/connection.ts`
- Modify: `app/package.json`

**Interfaces:**
- Consumes: `SqlDriver`, `QueryResult` (Task 3), `AppError` (Task 3).
- Produces: `getDriver(): Promise<SqlDriver>` — the singleton the real app uses. No automated test (it needs a live Tauri webview); correctness was hand-verified in Task 2 and is exercised by the existing Playwright suite after Task 17.

- [ ] **Step 1: Add the JS dependency**

Run from `app/`:

```bash
npm install @tauri-apps/plugin-sql
```

- [ ] **Step 2: Write the driver adapter**

Create `app/src/lib/db/pluginSqlDriver.ts`:

```ts
import type Database from '@tauri-apps/plugin-sql';
import type { QueryResult, SqlDriver } from './driver';

export function createPluginSqlDriver(db: Database): SqlDriver {
	return {
		select: (sql, params = []) => db.select(sql, params),
		execute: async (sql, params = []): Promise<QueryResult> => {
			const result = await db.execute(sql, params);
			return {
				lastInsertId: result.lastInsertId ?? 0,
				rowsAffected: result.rowsAffected
			};
		}
	};
}
```

- [ ] **Step 3: Write the connection singleton**

Create `app/src/lib/db/connection.ts`:

```ts
import Database from '@tauri-apps/plugin-sql';
import { AppError } from './error';
import type { SqlDriver } from './driver';
import { createPluginSqlDriver } from './pluginSqlDriver';

/** Must match SQL_CONNECTION in src-tauri/src/lib.rs verbatim — tauri-plugin-sql
 * keys registered migrations by this exact string. */
const CONNECTION_STRING = 'sqlite:mushpoint.sqlite3';

function hasBackend() {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let driver: Promise<SqlDriver> | null = null;

/** The one live connection for the whole app, lazily created on first use. */
export function getDriver(): Promise<SqlDriver> {
	if (!driver) {
		driver = connect();
	}
	return driver;
}

async function connect(): Promise<SqlDriver> {
	if (!hasBackend()) {
		throw new AppError(
			'unavailable',
			'The desktop backend is not running. Start the app with `npm run tauri dev` instead of `npm run dev`.'
		);
	}

	const db = await Database.load(CONNECTION_STRING);
	// Foreign keys are off by default in SQLite; the schema leans on ON DELETE rules.
	await db.execute('PRAGMA foreign_keys = ON');
	return createPluginSqlDriver(db);
}
```

- [ ] **Step 4: Type-check**

Run: `npm run check` (from `app/`)
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/package-lock.json app/src/lib/db/pluginSqlDriver.ts app/src/lib/db/connection.ts
git commit -m "feat: add plugin-sql driver and connection singleton"
```

---

### Task 6: Pure date helpers (`db/logic/dates.ts`)

**Files:**
- Create: `app/src/lib/db/logic/dates.ts`
- Test: `app/src/lib/db/logic/dates.spec.ts`

**Interfaces:**
- Produces: `addDays(date: string, days: number): string`, `compareDates(a: string, b: string): number`, `weekdayOf(date: string): number` (`0`=Sunday..`6`=Saturday, matching `Date.getUTCDay()`).

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/db/logic/dates.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addDays, compareDates, weekdayOf } from './dates';

describe('addDays', () => {
	it('adds and subtracts days across month boundaries', () => {
		expect(addDays('2026-07-30', 1)).toBe('2026-07-31');
		expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
		expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
	});
});

describe('compareDates', () => {
	it('orders chronologically', () => {
		expect(compareDates('2026-07-30', '2026-07-31')).toBeLessThan(0);
		expect(compareDates('2026-07-31', '2026-07-30')).toBeGreaterThan(0);
		expect(compareDates('2026-07-31', '2026-07-31')).toBe(0);
	});
});

describe('weekdayOf', () => {
	it('matches known weekdays', () => {
		// 2026-07-27 is a Monday.
		expect(weekdayOf('2026-07-27')).toBe(1);
		expect(weekdayOf('2026-08-01')).toBe(6); // Saturday
		expect(weekdayOf('2026-08-02')).toBe(0); // Sunday
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/logic/dates.spec.ts`
Expected: FAIL — `./dates` does not exist.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/db/logic/dates.ts`:

```ts
/** All calendar-day arithmetic on `YYYY-MM-DD` strings goes through here, anchored
 * to UTC midnight so DST transitions never shift a day off by one. */

function toUtcDate(date: string): Date {
	const [year, month, day] = date.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day));
}

function fromUtcDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
	const d = toUtcDate(date);
	d.setUTCDate(d.getUTCDate() + days);
	return fromUtcDate(d);
}

/** `YYYY-MM-DD` strings already compare chronologically as plain strings; this
 * just names that fact so call sites read like a date comparison. */
export function compareDates(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/** 0 = Sunday .. 6 = Saturday, matching `Date.getUTCDay()`. */
export function weekdayOf(date: string): number {
	return toUtcDate(date).getUTCDay();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/logic/dates.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db/logic/dates.ts app/src/lib/db/logic/dates.spec.ts
git commit -m "feat: add pure date-arithmetic helpers"
```

---

### Task 7: `db/logic/progress.ts`

**Files:**
- Create: `app/src/lib/db/logic/progress.ts`
- Test: `app/src/lib/db/logic/progress.spec.ts`

**Interfaces:**
- Consumes: `Task`, `TaskStatus` types from `$lib/api/types`.
- Produces: `average(completions: number[]): number`, `subgoalProgress(isComplete: boolean, taskCompletions: number[]): number`, `goalProgress(subgoalProgresses: number[], directTaskCompletions: number[]): number`, `taskCompletion(status: TaskStatus): number`, `countsTowardProgress(task: Task): boolean`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/db/logic/progress.spec.ts` (every case ported 1:1 from `src-tauri/src/progress.rs`):

```ts
import { describe, expect, it } from 'vitest';
import {
	average,
	countsTowardProgress,
	goalProgress,
	subgoalProgress,
	taskCompletion
} from './progress';
import type { Task } from '../../api/types';

function assertClose(actual: number, expected: number) {
	expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
}

describe('average', () => {
	it('is zero for no completions', () => {
		assertClose(average([]), 0);
	});

	it('averages values', () => {
		assertClose(average([0, 1]), 0.5);
		assertClose(average([1, 1, 1]), 1);
	});
});

describe('subgoalProgress', () => {
	it('without tasks uses its own flag', () => {
		assertClose(subgoalProgress(false, []), 0);
		assertClose(subgoalProgress(true, []), 1);
	});

	it('with tasks ignores its own flag', () => {
		assertClose(subgoalProgress(true, [0, 0]), 0);
		assertClose(subgoalProgress(false, [1, 1]), 1);
	});
});

describe('goalProgress', () => {
	it('is zero with no children', () => {
		assertClose(goalProgress([], []), 0);
	});

	it('weighs subgoals and direct tasks equally', () => {
		// Three children, one complete.
		assertClose(goalProgress([1, 0], [0]), 1 / 3);
	});

	it('a half-done subgoal contributes a half', () => {
		const half = subgoalProgress(false, [1, 0]);
		assertClose(half, 0.5);
		assertClose(goalProgress([half], [1]), 0.75);
	});

	it('can regress after reaching full', () => {
		const full = goalProgress([1], [1]);
		assertClose(full, 1);
		assertClose(goalProgress([1], [0]), 0.5);
	});
});

describe('taskCompletion', () => {
	it('counts only done as complete', () => {
		expect(taskCompletion('done')).toBe(1);
		expect(taskCompletion('todo')).toBe(0);
		expect(taskCompletion('in_progress')).toBe(0);
	});
});

describe('countsTowardProgress', () => {
	const base: Task = {
		id: 1,
		title: 'Stretch',
		status: 'todo',
		dueDate: null,
		goalId: null,
		subgoalId: null,
		recurrence: null,
		createdAt: '',
		updatedAt: ''
	};

	it('is true for one-off tasks, false for habits', () => {
		expect(countsTowardProgress(base)).toBe(true);
		expect(countsTowardProgress({ ...base, recurrence: 'daily' })).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/logic/progress.spec.ts`
Expected: FAIL — `./progress` does not exist.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/db/logic/progress.ts`:

```ts
import type { Task, TaskStatus } from '../../api/types';

/** Mean of the given completions, or 0 when there are no children at all. */
export function average(completions: number[]): number {
	if (completions.length === 0) return 0;
	return completions.reduce((sum, value) => sum + value, 0) / completions.length;
}

/** A subgoal with tasks is driven by its tasks; a subgoal with none falls back
 * to its own manual checkbox. */
export function subgoalProgress(isComplete: boolean, taskCompletions: number[]): number {
	if (taskCompletions.length === 0) return isComplete ? 1 : 0;
	return average(taskCompletions);
}

/** Subgoals and directly-linked tasks are equal-weight units of the parent. */
export function goalProgress(
	subgoalProgresses: number[],
	directTaskCompletions: number[]
): number {
	return average([...subgoalProgresses, ...directTaskCompletions]);
}

/** A task counts toward progress only once it is done; in_progress is a
 * workflow state, not partial credit. */
export function taskCompletion(status: TaskStatus): number {
	return status === 'done' ? 1 : 0;
}

/** A habit has no end state, so it is left out of the progress average entirely. */
export function countsTowardProgress(task: Task): boolean {
	return task.recurrence === null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/logic/progress.spec.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db/logic/progress.ts app/src/lib/db/logic/progress.spec.ts
git commit -m "feat: port progress math to TypeScript"
```

---

### Task 8: `db/logic/streak.ts`

**Files:**
- Create: `app/src/lib/db/logic/streak.ts`
- Test: `app/src/lib/db/logic/streak.spec.ts`

**Interfaces:**
- Consumes: `addDays`, `compareDates`, `weekdayOf` (Task 6); `Recurrence`, `CellState` types from `$lib/api/types`.
- Produces: `Streak { current: number; longest: number }`, `expectedDays(rec: Recurrence, anchorWeekday: number, from: string, to: string): string[]`, `stateOf(day: string, done: Set<string>, grace: number, today: string): CellState`, `summarize(expected: string[], done: Set<string>, grace: number, today: string): Streak`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/db/logic/streak.spec.ts` (every case ported 1:1 from `src-tauri/src/streak.rs`; 2026-07-27 is a Monday, so that week runs Mon the 27th to Sun 2026-08-02, same as the Rust comment):

```ts
import { describe, expect, it } from 'vitest';
import { expectedDays, stateOf, summarize } from './streak';

describe('expectedDays', () => {
	it('daily expects every day in the range', () => {
		const days = expectedDays('daily', 1, '2026-07-27', '2026-07-30');
		expect(days).toHaveLength(4);
		expect(days[0]).toBe('2026-07-27');
		expect(days[3]).toBe('2026-07-30');
	});

	it('weekdays skips the weekend', () => {
		const days = expectedDays('weekdays', 1, '2026-07-27', '2026-08-02');
		expect(days).toHaveLength(5);
		expect(days.at(-1)).toBe('2026-07-31');
	});

	it('weekly expects only its anchor weekday', () => {
		// Tuesday = 2.
		const days = expectedDays('weekly', 2, '2026-07-27', '2026-08-11');
		expect(days).toEqual(['2026-07-28', '2026-08-04', '2026-08-11']);
	});
});

describe('stateOf', () => {
	it('an occurrence completed within grace still counts', () => {
		const log = new Set(['2026-07-30']);
		const today = '2026-07-31';
		// Grace 2: the 28th's window is [28, 30], covered by the completion on the 30th.
		expect(stateOf('2026-07-28', log, 2, today)).toBe('done');
		// Grace 1: window is [28, 29], closed before the completion landed.
		expect(stateOf('2026-07-28', log, 1, today)).toBe('missed');
	});

	it('an open window is pending, not missed', () => {
		const log = new Set<string>();
		const today = '2026-07-31';
		expect(stateOf(today, log, 2, today)).toBe('pending');
		expect(stateOf('2026-07-29', log, 2, today)).toBe('pending');
		expect(stateOf('2026-07-28', log, 2, today)).toBe('missed');
	});

	it('grace zero demands the exact day', () => {
		const log = new Set(['2026-07-30']);
		const today = '2026-07-31';
		expect(stateOf('2026-07-30', log, 0, today)).toBe('done');
		expect(stateOf('2026-07-29', log, 0, today)).toBe('missed');
	});
});

describe('summarize', () => {
	it('a pending day does not end the current streak', () => {
		const today = '2026-07-31';
		const expected = expectedDays('daily', 1, '2026-07-28', today);
		const log = new Set(['2026-07-28', '2026-07-29', '2026-07-30']);
		const streak = summarize(expected, log, 0, today);
		expect(streak.current).toBe(3);
		expect(streak.longest).toBe(3);
	});

	it('a closed miss resets current but not longest', () => {
		const today = '2026-07-31';
		const expected = expectedDays('daily', 1, '2026-07-20', today);
		const log = new Set([
			'2026-07-20',
			'2026-07-21',
			'2026-07-22',
			'2026-07-23',
			'2026-07-29',
			'2026-07-30'
		]);
		const streak = summarize(expected, log, 0, today);
		expect(streak.current).toBe(2);
		expect(streak.longest).toBe(4);
	});

	it('an empty history has no streak', () => {
		const streak = summarize([], new Set(), 2, '2026-07-31');
		expect(streak).toEqual({ current: 0, longest: 0 });
	});

	it('a weekly habit counts weeks, not days', () => {
		const today = '2026-08-11';
		const expected = expectedDays('weekly', 2, '2026-07-28', today);
		const log = new Set(['2026-07-28', '2026-08-04']);
		const streak = summarize(expected, log, 2, today);
		expect(streak.current).toBe(2);
		expect(streak.longest).toBe(2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/logic/streak.spec.ts`
Expected: FAIL — `./streak` does not exist.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/db/logic/streak.ts`:

```ts
import type { CellState, Recurrence } from '../../api/types';
import { addDays, compareDates, weekdayOf } from './dates';

export interface Streak {
	current: number;
	longest: number;
}

const WEEKEND = new Set([0, 6]); // Sunday, Saturday

/** Every day in `from..=to` that the cadence expects an occurrence on.
 * `anchorWeekday` only matters for `weekly`; the other cadences ignore it. */
export function expectedDays(
	rec: Recurrence,
	anchorWeekday: number,
	from: string,
	to: string
): string[] {
	const days: string[] = [];
	let day = from;

	while (compareDates(day, to) <= 0) {
		const expected =
			rec === 'daily'
				? true
				: rec === 'weekdays'
					? !WEEKEND.has(weekdayOf(day))
					: weekdayOf(day) === anchorWeekday;
		if (expected) days.push(day);
		day = addDays(day, 1);
	}

	return days;
}

/** An occurrence is satisfied by a completion on its own day or up to `grace`
 * days later. Until that window closes it is pending rather than missed, so an
 * untouched task today never zeroes yesterday's streak. */
export function stateOf(day: string, done: Set<string>, grace: number, today: string): CellState {
	let satisfied = false;
	for (let offset = 0; offset <= grace; offset += 1) {
		if (done.has(addDays(day, offset))) {
			satisfied = true;
			break;
		}
	}

	if (satisfied) return 'done';
	if (compareDates(addDays(day, grace), today) >= 0) return 'pending';
	return 'missed';
}

/** `current` walks back from the newest occurrence, skipping ones whose window
 * is still open. `longest` is the best run anywhere in the history. */
export function summarize(
	expected: string[],
	done: Set<string>,
	grace: number,
	today: string
): Streak {
	const states = expected.map((day) => stateOf(day, done, grace, today));

	let longest = 0;
	let run = 0;
	for (const state of states) {
		if (state === 'done') {
			run += 1;
			longest = Math.max(longest, run);
		} else if (state === 'missed') {
			run = 0;
		}
		// A still-open window neither extends nor breaks a run.
	}

	let current = 0;
	for (let i = states.length - 1; i >= 0; i -= 1) {
		const state = states[i];
		if (state === 'pending') continue;
		if (state === 'done') {
			current += 1;
		} else {
			break;
		}
	}

	return { current, longest };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/logic/streak.spec.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db/logic/streak.ts app/src/lib/db/logic/streak.spec.ts
git commit -m "feat: port streak math to TypeScript"
```

---

### Task 9: `db/repo/helpers.ts`

**Files:**
- Create: `app/src/lib/db/repo/helpers.ts`
- Test: `app/src/lib/db/repo/helpers.spec.ts`

**Interfaces:**
- Consumes: `AppError` (Task 3).
- Produces: `now(): string`, `requiredText(field: string, value: string): string`, `optionalText(value: string | null): string | null`, `today(): string`, `localDateOf(timestamp: string): string`, `parseDateOrThrow(value: string): string`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/db/repo/helpers.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { localDateOf, optionalText, parseDateOrThrow, requiredText, today } from './helpers';
import { AppError } from '../error';

describe('requiredText', () => {
	it('trims and accepts non-blank input', () => {
		expect(requiredText('title', '  Ship v1  ')).toBe('Ship v1');
	});

	it('rejects blank or whitespace-only input', () => {
		expect(() => requiredText('title', '   ')).toThrow(AppError);
		try {
			requiredText('title', '');
		} catch (err) {
			expect((err as AppError).kind).toBe('validation');
		}
	});
});

describe('optionalText', () => {
	it('trims non-empty values and passes null through', () => {
		expect(optionalText('  hi  ')).toBe('hi');
		expect(optionalText(null)).toBeNull();
	});

	it('treats whitespace-only input as absent', () => {
		expect(optionalText('   ')).toBeNull();
	});
});

describe('today', () => {
	it('returns a YYYY-MM-DD string', () => {
		expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('localDateOf', () => {
	it('reads the local calendar day of an RFC 3339 timestamp', () => {
		expect(localDateOf('2026-07-30T23:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('rejects an unreadable timestamp', () => {
		expect(() => localDateOf('not a date')).toThrow(AppError);
	});
});

describe('parseDateOrThrow', () => {
	it('accepts a well-formed calendar date', () => {
		expect(parseDateOrThrow('2026-07-31')).toBe('2026-07-31');
	});

	it('rejects malformed input', () => {
		expect(() => parseDateOrThrow('2026/07/31')).toThrow(AppError);
	});

	it('rejects a date that does not exist', () => {
		expect(() => parseDateOrThrow('2026-02-30')).toThrow(AppError);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/repo/helpers.spec.ts`
Expected: FAIL — `./helpers` does not exist.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/db/repo/helpers.ts`:

```ts
import { AppError } from '../error';

/** Timestamps are stored as RFC 3339 strings — sortable as text, unambiguous
 * once read back. */
export function now(): string {
	return new Date().toISOString();
}

/** Trims a user-supplied name/title and rejects it if nothing is left. */
export function requiredText(field: string, value: string): string {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		throw AppError.validation(`${field} cannot be empty`);
	}
	return trimmed;
}

/** Trims an optional field, treating whitespace-only input as absent so the
 * database never holds a mix of NULL and "" for the same meaning. */
export function optionalText(value: string | null): string | null {
	if (value === null) return null;
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

/** Streaks are reckoned in local calendar days: a habit checked off at 11pm
 * belongs to that evening, not to tomorrow in UTC. */
export function today(): string {
	const d = new Date();
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The local calendar day a stored RFC 3339 timestamp fell on. */
export function localDateOf(timestamp: string): string {
	const d = new Date(timestamp);
	if (Number.isNaN(d.getTime())) {
		throw AppError.validation(`unreadable timestamp ${timestamp}`);
	}
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Validates a `YYYY-MM-DD` string is both well-formed and a real calendar date. */
export function parseDateOrThrow(value: string): string {
	const match = DATE_PATTERN.exec(value);
	if (!match) {
		throw AppError.validation(`bad date ${value}: expected YYYY-MM-DD`);
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const parsed = new Date(Date.UTC(year, month - 1, day));
	const roundTrips =
		parsed.getUTCFullYear() === year &&
		parsed.getUTCMonth() === month - 1 &&
		parsed.getUTCDate() === day;
	if (!roundTrips) {
		throw AppError.validation(`bad date ${value}: not a real date`);
	}
	return value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/repo/helpers.spec.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db/repo/helpers.ts app/src/lib/db/repo/helpers.spec.ts
git commit -m "feat: port repo helper functions to TypeScript"
```

---

### Task 10: `db/repo/category.ts`

**Files:**
- Create: `app/src/lib/db/repo/category.ts`
- Test: `app/src/lib/db/repo/category.spec.ts`

**Interfaces:**
- Consumes: `SqlDriver` (Task 3), `createTestDriver` (Task 4), `now`/`optionalText`/`requiredText` (Task 9), `AppError` (Task 3), `Category`/`CategoryInput` from `$lib/api/types`.
- Produces: `list(driver): Promise<Category[]>`, `get(driver, id): Promise<Category>`, `create(driver, input): Promise<Category>`, `update(driver, id, input): Promise<Category>`, `remove(driver, id): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/db/repo/category.spec.ts` (ported from `repo/category.rs`):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import { AppError } from '../error';
import * as category from './category';
import type { CategoryInput } from '../../api/types';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

function input(name: string): CategoryInput {
	return { name, colorToken: null };
}

describe('category', () => {
	it('lists the five seeded defaults', async () => {
		expect(await category.list(driver)).toHaveLength(5);
	});

	it('creates a custom category', async () => {
		const created = await category.create(driver, input('  Reading  '));
		expect(created.name).toBe('Reading');
		expect(created.isDefault).toBe(false);
	});

	it('rejects a blank name', async () => {
		await expect(category.create(driver, input('   '))).rejects.toMatchObject({
			kind: 'validation'
		});
	});

	it('rejects a duplicate name', async () => {
		await expect(category.create(driver, input('Gym'))).rejects.toMatchObject({
			kind: 'validation'
		});
	});

	it('updates and deletes', async () => {
		const created = await category.create(driver, input('Readin'));
		const renamed = await category.update(driver, created.id, input('Reading'));
		expect(renamed.name).toBe('Reading');

		await category.remove(driver, created.id);
		await expect(category.get(driver, created.id)).rejects.toMatchObject({ kind: 'not_found' });
	});

	it('reports missing categories', async () => {
		await expect(category.update(driver, 999, input('Nope'))).rejects.toMatchObject({
			kind: 'not_found'
		});
		await expect(category.remove(driver, 999)).rejects.toMatchObject({ kind: 'not_found' });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/repo/category.spec.ts`
Expected: FAIL — `./category` does not exist.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/db/repo/category.ts`:

```ts
import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { Category, CategoryInput } from '../../api/types';
import { now, optionalText, requiredText } from './helpers';

const COLUMNS = 'id, name, color_token, is_default, created_at';

interface CategoryRow {
	id: number;
	name: string;
	color_token: string | null;
	is_default: number;
	created_at: string;
}

function map(row: CategoryRow): Category {
	return {
		id: row.id,
		name: row.name,
		colorToken: row.color_token,
		isDefault: Boolean(row.is_default),
		createdAt: row.created_at
	};
}

export async function list(driver: SqlDriver): Promise<Category[]> {
	const rows = await driver.select<CategoryRow>(
		`SELECT ${COLUMNS} FROM categories ORDER BY is_default DESC, name`
	);
	return rows.map(map);
}

export async function get(driver: SqlDriver, id: number): Promise<Category> {
	const rows = await driver.select<CategoryRow>(`SELECT ${COLUMNS} FROM categories WHERE id = ?1`, [
		id
	]);
	const row = rows[0];
	if (!row) throw AppError.notFound('category', id);
	return map(row);
}

export async function create(driver: SqlDriver, input: CategoryInput): Promise<Category> {
	const name = requiredText('category name', input.name);
	let result;
	try {
		result = await driver.execute(
			'INSERT INTO categories (name, color_token, is_default, created_at) VALUES (?1, ?2, 0, ?3)',
			[name, optionalText(input.colorToken), now()]
		);
	} catch (err) {
		throw duplicateNameAsValidation(err);
	}
	return get(driver, result.lastInsertId);
}

export async function update(
	driver: SqlDriver,
	id: number,
	input: CategoryInput
): Promise<Category> {
	const name = requiredText('category name', input.name);
	let result;
	try {
		result = await driver.execute(
			'UPDATE categories SET name = ?1, color_token = ?2 WHERE id = ?3',
			[name, optionalText(input.colorToken), id]
		);
	} catch (err) {
		throw duplicateNameAsValidation(err);
	}
	if (result.rowsAffected === 0) throw AppError.notFound('category', id);
	return get(driver, id);
}

/** Goals in a deleted category keep existing; their categoryId becomes NULL
 * (see the ON DELETE SET NULL rule in the schema). */
export async function remove(driver: SqlDriver, id: number): Promise<void> {
	const result = await driver.execute('DELETE FROM categories WHERE id = ?1', [id]);
	if (result.rowsAffected === 0) throw AppError.notFound('category', id);
}

/** The UNIQUE(name) constraint is a user-facing rule, not an internal failure. */
function duplicateNameAsValidation(err: unknown): AppError {
	if (err instanceof AppError) return err;
	const message = err instanceof Error ? err.message : String(err);
	if (/unique/i.test(message)) {
		return AppError.validation('a category with that name already exists');
	}
	return new AppError('database', message);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/repo/category.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db/repo/category.ts app/src/lib/db/repo/category.spec.ts
git commit -m "feat: port category repo to TypeScript"
```

---

### Task 11: `db/repo/settings.ts`

**Files:**
- Create: `app/src/lib/db/repo/settings.ts`
- Test: `app/src/lib/db/repo/settings.spec.ts`

**Interfaces:**
- Consumes: `SqlDriver`, `AppError`, `now` (Task 9), `Settings` type from `$lib/api/types`.
- Produces: `THEMES: readonly string[]`, `get(driver): Promise<Settings>`, `graceDays(driver): Promise<number>`, `setTheme(driver, theme): Promise<Settings>`, `setGraceDays(driver, days): Promise<Settings>`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/db/repo/settings.spec.ts` (ported from `repo/settings.rs`):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as settings from './settings';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

describe('settings', () => {
	it('defaults to nocturne', async () => {
		expect((await settings.get(driver)).activeTheme).toBe('nocturne');
	});

	it('switches to a known theme', async () => {
		await settings.setTheme(driver, 'coquette');
		expect((await settings.get(driver)).activeTheme).toBe('coquette');
	});

	it('rejects an unknown theme', async () => {
		await expect(settings.setTheme(driver, 'vaporwave')).rejects.toMatchObject({
			kind: 'validation'
		});
		expect((await settings.get(driver)).activeTheme).toBe('nocturne');
	});

	it('the grace period starts at two days', async () => {
		expect((await settings.get(driver)).streakGraceDays).toBe(2);
		expect(await settings.graceDays(driver)).toBe(2);
	});

	it('the grace period can be changed within range', async () => {
		expect((await settings.setGraceDays(driver, 0)).streakGraceDays).toBe(0);
		expect((await settings.setGraceDays(driver, 7)).streakGraceDays).toBe(7);
	});

	it('rejects a grace period outside zero to seven', async () => {
		await expect(settings.setGraceDays(driver, 8)).rejects.toMatchObject({ kind: 'validation' });
		await expect(settings.setGraceDays(driver, -1)).rejects.toMatchObject({ kind: 'validation' });
		expect((await settings.get(driver)).streakGraceDays).toBe(2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/repo/settings.spec.ts`
Expected: FAIL — `./settings` does not exist.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/db/repo/settings.ts`:

```ts
import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { Settings } from '../../api/types';
import { now } from './helpers';

/** Themes the app ships with. The frontend maps each name to a token set; this
 * only guards that an unknown name never gets persisted. */
export const THEMES: readonly string[] = ['nocturne', 'coquette'];

interface SettingsRow {
	active_theme: string;
	streak_grace_days: number;
	updated_at: string;
}

function map(row: SettingsRow): Settings {
	return {
		activeTheme: row.active_theme,
		streakGraceDays: row.streak_grace_days,
		updatedAt: row.updated_at
	};
}

export async function get(driver: SqlDriver): Promise<Settings> {
	const rows = await driver.select<SettingsRow>(
		'SELECT active_theme, streak_grace_days, updated_at FROM settings WHERE id = 1'
	);
	return map(rows[0]);
}

/** Just the grace number, for the streak math. Read on every streak computation
 * so changing it in Settings updates every card immediately. */
export async function graceDays(driver: SqlDriver): Promise<number> {
	const rows = await driver.select<{ streak_grace_days: number }>(
		'SELECT streak_grace_days FROM settings WHERE id = 1'
	);
	return rows[0].streak_grace_days;
}

export async function setTheme(driver: SqlDriver, theme: string): Promise<Settings> {
	if (!THEMES.includes(theme)) {
		throw AppError.validation(`unknown theme: ${theme}`);
	}
	await driver.execute('UPDATE settings SET active_theme = ?1, updated_at = ?2 WHERE id = 1', [
		theme,
		now()
	]);
	return get(driver);
}

/** Checked here as well as by the schema, so the UI gets a validation error with
 * a readable message instead of a raw constraint failure. */
export async function setGraceDays(driver: SqlDriver, days: number): Promise<Settings> {
	if (days < 0 || days > 7) {
		throw AppError.validation(`grace period must be between 0 and 7 days, got ${days}`);
	}
	await driver.execute(
		'UPDATE settings SET streak_grace_days = ?1, updated_at = ?2 WHERE id = 1',
		[days, now()]
	);
	return get(driver);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/repo/settings.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db/repo/settings.ts app/src/lib/db/repo/settings.spec.ts
git commit -m "feat: port settings repo to TypeScript"
```

---

### Task 12: `db/repo/task.ts`

**Files:**
- Create: `app/src/lib/db/repo/task.ts`
- Test: `app/src/lib/db/repo/task.spec.ts`

**Interfaces:**
- Consumes: `SqlDriver`, `AppError`, `now`/`optionalText`/`requiredText`/`today` (Task 9), `ensureExists` from `./goal` (**forward reference** — `goal.ts` is written in Task 14; to keep this task's tests runnable on their own before `goal.ts` exists, `resolveParents`' goal-existence check queries the `goals` table directly instead of importing `./goal`, exactly like `subgoal_id`'s owner lookup already does. `./goal` is *not* imported by this file at all).
- Produces: `list(driver): Promise<TaskSummary[]>`, `listRecurring(driver): Promise<Task[]>`, `listForSubgoal(driver, subgoalId): Promise<Task[]>`, `listDirectForGoal(driver, goalId): Promise<Task[]>`, `get(driver, id): Promise<Task>`, `create(driver, input): Promise<Task>`, `update(driver, id, input): Promise<Task>`, `setStatus(driver, id, status): Promise<Task>`, `remove(driver, id): Promise<void>`, `isRecurring(task): boolean`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/db/repo/task.spec.ts` (ported from `repo/task.rs`; goals/subgoals seeded with raw SQL here since `goal.ts`/`subgoal.ts` don't exist until Tasks 13–14):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as task from './task';
import type { TaskInput } from '../../api/types';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

async function seedGoal(): Promise<number> {
	const now = new Date().toISOString();
	const result = await driver.execute(
		"INSERT INTO goals (title, timeframe, created_at, updated_at) VALUES ('Ship v1', 'mid', ?1, ?1)",
		[now]
	);
	return result.lastInsertId;
}

async function seedSubgoal(goalId: number): Promise<number> {
	const now = new Date().toISOString();
	const result = await driver.execute(
		"INSERT INTO subgoals (goal_id, title, created_at, updated_at) VALUES (?1, 'Write the schema', ?2, ?2)",
		[goalId, now]
	);
	return result.lastInsertId;
}

function taskInput(title: string): TaskInput {
	return { title, dueDate: null, goalId: null, subgoalId: null, recurrence: null };
}

describe('task', () => {
	it('creates an unlinked task as todo', async () => {
		const created = await task.create(driver, taskInput('Buy a notebook'));
		expect(created.status).toBe('todo');
		expect(created.goalId).toBeNull();
	});

	it('a cadence makes a task recurring', async () => {
		const oneOff = await task.create(driver, taskInput('Buy a notebook'));
		const habit = await task.create(driver, { ...taskInput('Stretch'), recurrence: 'weekdays' });

		expect(task.isRecurring(oneOff)).toBe(false);
		expect(task.isRecurring(habit)).toBe(true);
		expect((await task.get(driver, habit.id)).recurrence).toBe('weekdays');
	});

	it('a subgoal task inherits that subgoals goal', async () => {
		const goalId = await seedGoal();
		const subgoalId = await seedSubgoal(goalId);

		const created = await task.create(driver, {
			// Deliberately wrong parent goal: the subgoal wins.
			...taskInput('Draft the tables'),
			goalId: null,
			subgoalId
		});

		expect(created.goalId).toBe(goalId);
		expect(created.subgoalId).toBe(subgoalId);
	});

	it('direct goal tasks exclude subgoal tasks', async () => {
		const goalId = await seedGoal();
		const subgoalId = await seedSubgoal(goalId);

		await task.create(driver, { ...taskInput('Read the OKR book'), goalId });
		await task.create(driver, { ...taskInput('Draft the tables'), subgoalId });

		expect(await task.listDirectForGoal(driver, goalId)).toHaveLength(1);
	});

	it('rejects linking to a missing parent', async () => {
		await expect(
			task.create(driver, { ...taskInput('Orphan'), goalId: 404 })
		).rejects.toMatchObject({ kind: 'not_found' });
		await expect(
			task.create(driver, { ...taskInput('Orphan'), subgoalId: 404 })
		).rejects.toMatchObject({ kind: 'not_found' });
	});

	it('status changes and deletes', async () => {
		const created = await task.create(driver, taskInput('Buy a notebook'));
		const done = await task.setStatus(driver, created.id, 'done');
		expect(done.status).toBe('done');

		await task.remove(driver, created.id);
		await expect(task.get(driver, created.id)).rejects.toMatchObject({ kind: 'not_found' });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/repo/task.spec.ts`
Expected: FAIL — `./task` does not exist.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/db/repo/task.ts`:

```ts
import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { Task, TaskInput, TaskStatus, TaskSummary, TaskUpdate } from '../../api/types';
import { now, optionalText, requiredText, today } from './helpers';

const COLUMNS =
	'id, title, status, due_date, goal_id, subgoal_id, recurrence, created_at, updated_at';
const ORDER = 'ORDER BY (due_date IS NULL), due_date, id';
const SUMMARY_COLUMNS = `t.id, t.title, t.status, t.due_date, t.goal_id, t.subgoal_id,
     t.recurrence, t.created_at, t.updated_at`;

interface TaskRow {
	id: number;
	title: string;
	status: TaskStatus;
	due_date: string | null;
	goal_id: number | null;
	subgoal_id: number | null;
	recurrence: Task['recurrence'];
	created_at: string;
	updated_at: string;
}

function map(row: TaskRow): Task {
	return {
		id: row.id,
		title: row.title,
		status: row.status,
		dueDate: row.due_date,
		goalId: row.goal_id,
		subgoalId: row.subgoal_id,
		recurrence: row.recurrence,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export function isRecurring(task: Task): boolean {
	return task.recurrence !== null;
}

/** The board's list. One join rather than a completion query per row. */
export async function list(driver: SqlDriver): Promise<TaskSummary[]> {
	const rows = await driver.select<TaskRow & { completed_today: number }>(
		`SELECT ${SUMMARY_COLUMNS}, c.id IS NOT NULL AS completed_today
         FROM tasks t
         LEFT JOIN task_completions c
             ON c.task_id = t.id AND c.completed_on = ?1
         ORDER BY (t.due_date IS NULL), t.due_date, t.id`,
		[today()]
	);
	return rows.map((row) => ({ ...map(row), completedToday: Boolean(row.completed_today) }));
}

/** Every habit, for the streak cards. */
export async function listRecurring(driver: SqlDriver): Promise<Task[]> {
	const rows = await driver.select<TaskRow>(
		`SELECT ${COLUMNS} FROM tasks WHERE recurrence IS NOT NULL ${ORDER}`
	);
	return rows.map(map);
}

export async function listForSubgoal(driver: SqlDriver, subgoalId: number): Promise<Task[]> {
	const rows = await driver.select<TaskRow>(
		`SELECT ${COLUMNS} FROM tasks WHERE subgoal_id = ?1 ${ORDER}`,
		[subgoalId]
	);
	return rows.map(map);
}

/** Tasks hanging straight off the goal — the ones that count as its own direct
 * children for progress. Tasks under a subgoal are counted by that subgoal. */
export async function listDirectForGoal(driver: SqlDriver, goalId: number): Promise<Task[]> {
	const rows = await driver.select<TaskRow>(
		`SELECT ${COLUMNS} FROM tasks WHERE goal_id = ?1 AND subgoal_id IS NULL ${ORDER}`,
		[goalId]
	);
	return rows.map(map);
}

export async function get(driver: SqlDriver, id: number): Promise<Task> {
	const rows = await driver.select<TaskRow>(`SELECT ${COLUMNS} FROM tasks WHERE id = ?1`, [id]);
	const row = rows[0];
	if (!row) throw AppError.notFound('task', id);
	return map(row);
}

export async function create(driver: SqlDriver, input: TaskInput): Promise<Task> {
	const title = requiredText('task title', input.title);
	const { goalId, subgoalId } = await resolveParents(driver, input.goalId, input.subgoalId);
	const timestamp = now();

	const result = await driver.execute(
		`INSERT INTO tasks (title, status, due_date, goal_id, subgoal_id, recurrence, created_at, updated_at)
         VALUES (?1, 'todo', ?2, ?3, ?4, ?5, ?6, ?6)`,
		[title, optionalText(input.dueDate), goalId, subgoalId, input.recurrence, timestamp]
	);

	return get(driver, result.lastInsertId);
}

export async function update(driver: SqlDriver, id: number, input: TaskUpdate): Promise<Task> {
	const title = requiredText('task title', input.title);
	const { goalId, subgoalId } = await resolveParents(driver, input.goalId, input.subgoalId);

	const result = await driver.execute(
		`UPDATE tasks
         SET title = ?1, status = ?2, due_date = ?3, goal_id = ?4, subgoal_id = ?5,
             recurrence = ?6, updated_at = ?7
         WHERE id = ?8`,
		[title, input.status, optionalText(input.dueDate), goalId, subgoalId, input.recurrence, now(), id]
	);

	if (result.rowsAffected === 0) throw AppError.notFound('task', id);
	return get(driver, id);
}

export async function setStatus(driver: SqlDriver, id: number, status: TaskStatus): Promise<Task> {
	const result = await driver.execute('UPDATE tasks SET status = ?1, updated_at = ?2 WHERE id = ?3', [
		status,
		now(),
		id
	]);
	if (result.rowsAffected === 0) throw AppError.notFound('task', id);
	return get(driver, id);
}

export async function remove(driver: SqlDriver, id: number): Promise<void> {
	const result = await driver.execute('DELETE FROM tasks WHERE id = ?1', [id]);
	if (result.rowsAffected === 0) throw AppError.notFound('task', id);
}

/** A task under a subgoal always belongs to that subgoal's goal, whatever the
 * caller passed — otherwise progress could count the task under the wrong parent. */
async function resolveParents(
	driver: SqlDriver,
	goalId: number | null,
	subgoalId: number | null
): Promise<{ goalId: number | null; subgoalId: number | null }> {
	if (subgoalId === null) {
		if (goalId !== null) {
			const rows = await driver.select('SELECT id FROM goals WHERE id = ?1', [goalId]);
			if (rows.length === 0) throw AppError.notFound('goal', goalId);
		}
		return { goalId, subgoalId: null };
	}

	const rows = await driver.select<{ goal_id: number }>(
		'SELECT goal_id FROM subgoals WHERE id = ?1',
		[subgoalId]
	);
	if (rows.length === 0) throw AppError.notFound('subgoal', subgoalId);
	return { goalId: rows[0].goal_id, subgoalId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/repo/task.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db/repo/task.ts app/src/lib/db/repo/task.spec.ts
git commit -m "feat: port task repo to TypeScript"
```

---

### Task 13: `db/repo/subgoal.ts`

**Files:**
- Create: `app/src/lib/db/repo/subgoal.ts`
- Test: `app/src/lib/db/repo/subgoal.spec.ts`

**Interfaces:**
- Consumes: `SqlDriver`, `AppError`, `now`/`optionalText`/`requiredText` (Task 9), `listForSubgoal` (Task 12, from `./task`), `countsTowardProgress`/`taskCompletion`/`subgoalProgress` (Task 7).
- Produces: `listAll(driver): Promise<Subgoal[]>`, `listForGoal(driver, goalId): Promise<Subgoal[]>`, `detailForGoal(driver, goalId): Promise<SubgoalDetail[]>`, `progressesForGoal(driver, goalId): Promise<number[]>`, `get(driver, id): Promise<Subgoal>`, `create(driver, input): Promise<Subgoal>`, `update(driver, id, input): Promise<Subgoal>`, `setComplete(driver, id, isComplete): Promise<Subgoal>`, `remove(driver, id): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/db/repo/subgoal.spec.ts` (ported from `repo/subgoal.rs`, goals seeded with raw SQL):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as subgoal from './subgoal';
import * as task from './task';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

async function seedGoal(): Promise<number> {
	const now = new Date().toISOString();
	const result = await driver.execute(
		"INSERT INTO goals (title, timeframe, created_at, updated_at) VALUES ('Ship v1', 'mid', ?1, ?1)",
		[now]
	);
	return result.lastInsertId;
}

async function add(goalId: number, title: string) {
	return subgoal.create(driver, { goalId, title, dueDate: null });
}

describe('subgoal', () => {
	it('new subgoals append in order', async () => {
		const goalId = await seedGoal();
		const first = await add(goalId, 'Write the schema');
		const second = await add(goalId, 'Wire the UI');

		expect([first.position, second.position]).toEqual([0, 1]);
		expect(await subgoal.listForGoal(driver, goalId)).toHaveLength(2);
	});

	it('list all spans every goal in position order', async () => {
		const firstGoal = await seedGoal();
		const secondGoal = await seedGoal();

		await add(firstGoal, 'Write the schema');
		await add(secondGoal, 'Book the flight');
		await add(firstGoal, 'Wire the UI');

		const titles = (await subgoal.listAll(driver)).map((s) => s.title);
		expect(titles).toEqual(['Write the schema', 'Wire the UI', 'Book the flight']);
	});

	it('rejects a missing goal', async () => {
		await expect(
			subgoal.create(driver, { goalId: 404, title: 'Orphan', dueDate: null })
		).rejects.toMatchObject({ kind: 'not_found' });
	});

	it('taskless subgoal progress follows its checkbox', async () => {
		const goalId = await seedGoal();
		const created = await add(goalId, 'Write the schema');

		expect(await subgoal.progressesForGoal(driver, goalId)).toEqual([0]);

		await subgoal.setComplete(driver, created.id, true);
		expect(await subgoal.progressesForGoal(driver, goalId)).toEqual([1]);
	});

	it('subgoal with tasks averages them', async () => {
		const goalId = await seedGoal();
		const created = await add(goalId, 'Write the schema');

		for (const title of ['Draft the tables', 'Add indexes']) {
			await task.create(driver, {
				title,
				dueDate: null,
				goalId: null,
				subgoalId: created.id,
				recurrence: null
			});
		}
		const first = (await task.listForSubgoal(driver, created.id))[0];
		await task.setStatus(driver, first.id, 'done');

		expect(await subgoal.progressesForGoal(driver, goalId)).toEqual([0.5]);
	});

	it('deleting a subgoal leaves its tasks on the goal', async () => {
		const goalId = await seedGoal();
		const created = await add(goalId, 'Write the schema');
		await task.create(driver, {
			title: 'Draft the tables',
			dueDate: null,
			goalId: null,
			subgoalId: created.id,
			recurrence: null
		});

		await subgoal.remove(driver, created.id);

		expect(await task.listDirectForGoal(driver, goalId)).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/repo/subgoal.spec.ts`
Expected: FAIL — `./subgoal` does not exist.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/db/repo/subgoal.ts`:

```ts
import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { Subgoal, SubgoalDetail, SubgoalInput, SubgoalUpdate } from '../../api/types';
import { now, optionalText, requiredText } from './helpers';
import * as task from './task';
import { countsTowardProgress, subgoalProgress, taskCompletion } from '../logic/progress';

const COLUMNS = 'id, goal_id, title, due_date, is_complete, position, created_at, updated_at';
const ORDER = 'ORDER BY position, id';

interface SubgoalRow {
	id: number;
	goal_id: number;
	title: string;
	due_date: string | null;
	is_complete: number;
	position: number;
	created_at: string;
	updated_at: string;
}

function map(row: SubgoalRow): Subgoal {
	return {
		id: row.id,
		goalId: row.goal_id,
		title: row.title,
		dueDate: row.due_date,
		isComplete: Boolean(row.is_complete),
		position: row.position,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

/** Every subgoal in the database, grouped by goal. The Task Manager needs this
 * to offer subgoals as task parents without loading one goal at a time. */
export async function listAll(driver: SqlDriver): Promise<Subgoal[]> {
	const rows = await driver.select<SubgoalRow>(
		`SELECT ${COLUMNS} FROM subgoals ORDER BY goal_id, position, id`
	);
	return rows.map(map);
}

export async function listForGoal(driver: SqlDriver, goalId: number): Promise<Subgoal[]> {
	const rows = await driver.select<SubgoalRow>(
		`SELECT ${COLUMNS} FROM subgoals WHERE goal_id = ?1 ${ORDER}`,
		[goalId]
	);
	return rows.map(map);
}

/** Each subgoal with its tasks and its own progress attached. */
export async function detailForGoal(driver: SqlDriver, goalId: number): Promise<SubgoalDetail[]> {
	const subgoals = await listForGoal(driver, goalId);
	const details: SubgoalDetail[] = [];
	for (const subgoal of subgoals) {
		const tasks = await task.listForSubgoal(driver, subgoal.id);
		const completions = tasks.filter(countsTowardProgress).map((t) => taskCompletion(t.status));
		details.push({ ...subgoal, progress: subgoalProgress(subgoal.isComplete, completions), tasks });
	}
	return details;
}

/** Just the progress numbers, for computing a parent goal's average. */
export async function progressesForGoal(driver: SqlDriver, goalId: number): Promise<number[]> {
	return (await detailForGoal(driver, goalId)).map((detail) => detail.progress);
}

export async function get(driver: SqlDriver, id: number): Promise<Subgoal> {
	const rows = await driver.select<SubgoalRow>(`SELECT ${COLUMNS} FROM subgoals WHERE id = ?1`, [
		id
	]);
	const row = rows[0];
	if (!row) throw AppError.notFound('subgoal', id);
	return map(row);
}

export async function create(driver: SqlDriver, input: SubgoalInput): Promise<Subgoal> {
	const title = requiredText('subgoal title', input.title);
	const owner = await driver.select('SELECT id FROM goals WHERE id = ?1', [input.goalId]);
	if (owner.length === 0) throw AppError.notFound('goal', input.goalId);

	const nextPosition = await driver.select<{ next: number }>(
		'SELECT COALESCE(MAX(position) + 1, 0) as next FROM subgoals WHERE goal_id = ?1',
		[input.goalId]
	);
	const timestamp = now();

	const result = await driver.execute(
		`INSERT INTO subgoals (goal_id, title, due_date, is_complete, position, created_at, updated_at)
         VALUES (?1, ?2, ?3, 0, ?4, ?5, ?5)`,
		[input.goalId, title, optionalText(input.dueDate), nextPosition[0].next, timestamp]
	);

	return get(driver, result.lastInsertId);
}

export async function update(
	driver: SqlDriver,
	id: number,
	input: SubgoalUpdate
): Promise<Subgoal> {
	const title = requiredText('subgoal title', input.title);
	const result = await driver.execute(
		`UPDATE subgoals SET title = ?1, due_date = ?2, is_complete = ?3, updated_at = ?4
         WHERE id = ?5`,
		[title, optionalText(input.dueDate), Number(input.isComplete), now(), id]
	);
	if (result.rowsAffected === 0) throw AppError.notFound('subgoal', id);
	return get(driver, id);
}

export async function setComplete(
	driver: SqlDriver,
	id: number,
	isComplete: boolean
): Promise<Subgoal> {
	const result = await driver.execute(
		'UPDATE subgoals SET is_complete = ?1, updated_at = ?2 WHERE id = ?3',
		[Number(isComplete), now(), id]
	);
	if (result.rowsAffected === 0) throw AppError.notFound('subgoal', id);
	return get(driver, id);
}

/** Deleting a subgoal keeps its tasks; they fall back to being direct tasks of
 * the goal (ON DELETE SET NULL on subgoal_id). */
export async function remove(driver: SqlDriver, id: number): Promise<void> {
	const result = await driver.execute('DELETE FROM subgoals WHERE id = ?1', [id]);
	if (result.rowsAffected === 0) throw AppError.notFound('subgoal', id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/repo/subgoal.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db/repo/subgoal.ts app/src/lib/db/repo/subgoal.spec.ts
git commit -m "feat: port subgoal repo to TypeScript"
```

---

### Task 14: `db/repo/goal.ts`

**Files:**
- Create: `app/src/lib/db/repo/goal.ts`
- Test: `app/src/lib/db/repo/goal.spec.ts`

**Interfaces:**
- Consumes: `SqlDriver`, `AppError`, `now`/`optionalText`/`requiredText` (Task 9), `category.get` (Task 10), `subgoal.progressesForGoal`/`subgoal.detailForGoal` (Task 13), `task.listDirectForGoal` (Task 12), `countsTowardProgress`/`taskCompletion`/`goalProgress` (Task 7). (The test file additionally uses `subgoal.create`, `task.create`, and `task.setStatus` to seed fixtures — those are test-only dependencies, not production ones.)
- Produces: `list(driver, status): Promise<GoalSummary[]>`, `getDetail(driver, id): Promise<GoalDetail>`, `get(driver, id): Promise<Goal>`, `ensureExists(driver, id): Promise<void>`, `create(driver, input): Promise<Goal>`, `update(driver, id, input): Promise<Goal>`, `setStatus(driver, id, status): Promise<Goal>`, `remove(driver, id, deleteOrphanedTasks): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/db/repo/goal.spec.ts` (ported from `repo/goal.rs`):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as goal from './goal';
import * as subgoal from './subgoal';
import * as task from './task';
import * as category from './category';
import type { GoalInput } from '../../api/types';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

function input(title: string): GoalInput {
	return {
		categoryId: null,
		title,
		description: null,
		timeframe: 'mid',
		dueDate: null,
		motivationText: null,
		motivationImagePath: null
	};
}

async function addSubgoal(goalId: number, title: string) {
	return (await subgoal.create(driver, { goalId, title, dueDate: null })).id;
}

async function addTask(goalId: number | null, subgoalId: number | null) {
	return (
		await task.create(driver, {
			title: 'A task',
			dueDate: null,
			goalId,
			subgoalId,
			recurrence: null
		})
	).id;
}

describe('goal', () => {
	it('creates a goal as active', async () => {
		const created = await goal.create(driver, input('Ship v1'));
		expect(created.status).toBe('active');
		expect(created.timeframe).toBe('mid');
	});

	it('rejects a blank title or missing category', async () => {
		await expect(goal.create(driver, input('  '))).rejects.toMatchObject({ kind: 'validation' });
		await expect(
			goal.create(driver, { ...input('Ship v1'), categoryId: 404 })
		).rejects.toMatchObject({ kind: 'not_found' });
	});

	it('a goal with no children sits at zero', async () => {
		await goal.create(driver, input('Ship v1'));
		const [summary] = await goal.list(driver, null);
		expect(summary.progress).toBe(0);
	});

	it('progress averages subgoals and direct tasks equally', async () => {
		const created = await goal.create(driver, input('Ship v1'));

		const subgoalId = await addSubgoal(created.id, 'Write the schema');
		const done = await addTask(null, subgoalId);
		await addTask(null, subgoalId);
		await task.setStatus(driver, done, 'done');

		const direct = await addTask(created.id, null);
		await task.setStatus(driver, direct, 'done');

		const detail = await goal.getDetail(driver, created.id);
		expect(detail.progress).toBe(0.75);
		expect(detail.subgoals[0].progress).toBe(0.5);
		expect(detail.directTasks).toHaveLength(1);
	});

	it('in-progress tasks do not count as partial', async () => {
		const created = await goal.create(driver, input('Ship v1'));
		const taskId = await addTask(created.id, null);
		await task.setStatus(driver, taskId, 'in_progress');

		expect((await goal.getDetail(driver, created.id)).progress).toBe(0);
	});

	it('status is independent of progress', async () => {
		const created = await goal.create(driver, input('Ship v1'));
		const taskId = await addTask(created.id, null);
		await task.setStatus(driver, taskId, 'done');

		expect((await goal.getDetail(driver, created.id)).progress).toBe(1);
		expect((await goal.get(driver, created.id)).status).toBe('active');

		await goal.setStatus(driver, created.id, 'completed');
		expect(await goal.list(driver, 'active')).toHaveLength(0);
		expect(await goal.list(driver, 'completed')).toHaveLength(1);
	});

	it('detail carries the linked category', async () => {
		const [firstCategory] = await category.list(driver);
		const created = await goal.create(driver, { ...input('Ship v1'), categoryId: firstCategory.id });

		const detail = await goal.getDetail(driver, created.id);
		expect(detail.category?.id).toBe(firstCategory.id);
	});

	it('deleting a goal removes its subgoals and unlinks its tasks', async () => {
		const created = await goal.create(driver, input('Ship v1'));
		const subgoalId = await addSubgoal(created.id, 'Write the schema');
		const directTaskId = await addTask(created.id, null);
		const subgoalTaskId = await addTask(null, subgoalId);

		await goal.remove(driver, created.id, false);

		await expect(goal.get(driver, created.id)).rejects.toMatchObject({ kind: 'not_found' });
		expect((await task.get(driver, directTaskId)).goalId).toBeNull();
		expect((await task.get(driver, subgoalTaskId)).subgoalId).toBeNull();
	});

	it('deleting a goal can also delete its subgoal tasks', async () => {
		const created = await goal.create(driver, input('Ship v1'));
		const subgoalId = await addSubgoal(created.id, 'Write the schema');
		const directTaskId = await addTask(created.id, null);
		const subgoalTaskId = await addTask(null, subgoalId);

		await goal.remove(driver, created.id, true);

		expect((await task.get(driver, directTaskId)).goalId).toBeNull();
		await expect(task.get(driver, subgoalTaskId)).rejects.toMatchObject({ kind: 'not_found' });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/repo/goal.spec.ts`
Expected: FAIL — `./goal` does not exist.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/db/repo/goal.ts`:

```ts
import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { Goal, GoalDetail, GoalInput, GoalStatus, GoalSummary } from '../../api/types';
import { now, optionalText, requiredText } from './helpers';
import * as category from './category';
import * as subgoal from './subgoal';
import * as task from './task';
import { countsTowardProgress, goalProgress, taskCompletion } from '../logic/progress';

const COLUMNS = `id, category_id, title, description, timeframe, status, due_date,
     motivation_text, motivation_image_path, created_at, updated_at`;
const ORDER = 'ORDER BY (due_date IS NULL), due_date, created_at DESC, id DESC';

interface GoalRow {
	id: number;
	category_id: number | null;
	title: string;
	description: string | null;
	timeframe: Goal['timeframe'];
	status: GoalStatus;
	due_date: string | null;
	motivation_text: string | null;
	motivation_image_path: string | null;
	created_at: string;
	updated_at: string;
}

function map(row: GoalRow): Goal {
	return {
		id: row.id,
		categoryId: row.category_id,
		title: row.title,
		description: row.description,
		timeframe: row.timeframe,
		status: row.status,
		dueDate: row.due_date,
		motivationText: row.motivation_text,
		motivationImagePath: row.motivation_image_path,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

/** Lists goals, optionally narrowed to one status — the Goals page shows active
 * ones by default and completed/archived behind a filter. */
export async function list(driver: SqlDriver, status: GoalStatus | null): Promise<GoalSummary[]> {
	const filter = status !== null ? 'WHERE status = ?1' : '';
	const rows = await driver.select<GoalRow>(
		`SELECT ${COLUMNS} FROM goals ${filter} ${ORDER}`,
		status !== null ? [status] : []
	);

	const summaries: GoalSummary[] = [];
	for (const row of rows.map(map)) {
		const subgoalProgresses = await subgoal.progressesForGoal(driver, row.id);
		const directTasks = await task.listDirectForGoal(driver, row.id);
		const completions = directTasks.filter(countsTowardProgress).map((t) => taskCompletion(t.status));

		summaries.push({
			...row,
			progress: goalProgress(subgoalProgresses, completions),
			subgoalCount: subgoalProgresses.length,
			taskCount: directTasks.length
		});
	}
	return summaries;
}

/** The goal plus its subgoals, tasks and derived progress, in one round trip. */
export async function getDetail(driver: SqlDriver, id: number): Promise<GoalDetail> {
	const goal = await get(driver, id);
	const subgoals = await subgoal.detailForGoal(driver, id);
	const directTasks = await task.listDirectForGoal(driver, id);

	const subgoalProgresses = subgoals.map((s) => s.progress);
	const completions = directTasks.filter(countsTowardProgress).map((t) => taskCompletion(t.status));
	const category_ = goal.categoryId !== null ? await category.get(driver, goal.categoryId) : null;

	return {
		...goal,
		progress: goalProgress(subgoalProgresses, completions),
		category: category_,
		subgoals,
		directTasks
	};
}

export async function get(driver: SqlDriver, id: number): Promise<Goal> {
	const rows = await driver.select<GoalRow>(`SELECT ${COLUMNS} FROM goals WHERE id = ?1`, [id]);
	const row = rows[0];
	if (!row) throw AppError.notFound('goal', id);
	return map(row);
}

export async function ensureExists(driver: SqlDriver, id: number): Promise<void> {
	const rows = await driver.select('SELECT id FROM goals WHERE id = ?1', [id]);
	if (rows.length === 0) throw AppError.notFound('goal', id);
}

export async function create(driver: SqlDriver, input: GoalInput): Promise<Goal> {
	const title = requiredText('goal title', input.title);
	if (input.categoryId !== null) {
		await category.get(driver, input.categoryId);
	}
	const timestamp = now();

	const result = await driver.execute(
		`INSERT INTO goals (category_id, title, description, timeframe, status, due_date,
                            motivation_text, motivation_image_path, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, ?7, ?8, ?8)`,
		[
			input.categoryId,
			title,
			optionalText(input.description),
			input.timeframe,
			optionalText(input.dueDate),
			optionalText(input.motivationText),
			optionalText(input.motivationImagePath),
			timestamp
		]
	);

	return get(driver, result.lastInsertId);
}

export async function update(driver: SqlDriver, id: number, input: GoalInput): Promise<Goal> {
	const title = requiredText('goal title', input.title);
	if (input.categoryId !== null) {
		await category.get(driver, input.categoryId);
	}

	const result = await driver.execute(
		`UPDATE goals
         SET category_id = ?1, title = ?2, description = ?3, timeframe = ?4, due_date = ?5,
             motivation_text = ?6, motivation_image_path = ?7, updated_at = ?8
         WHERE id = ?9`,
		[
			input.categoryId,
			title,
			optionalText(input.description),
			input.timeframe,
			optionalText(input.dueDate),
			optionalText(input.motivationText),
			optionalText(input.motivationImagePath),
			now(),
			id
		]
	);

	if (result.rowsAffected === 0) throw AppError.notFound('goal', id);
	return get(driver, id);
}

/** Completing or archiving is always an explicit user action — progress hitting
 * 100% never flips this by itself. */
export async function setStatus(driver: SqlDriver, id: number, status: GoalStatus): Promise<Goal> {
	const result = await driver.execute('UPDATE goals SET status = ?1, updated_at = ?2 WHERE id = ?3', [
		status,
		now(),
		id
	]);
	if (result.rowsAffected === 0) throw AppError.notFound('goal', id);
	return get(driver, id);
}

/** Subgoals cascade-delete with the goal; their tasks only lose their link
 * (ON DELETE SET NULL) and would otherwise survive as standalone tasks. The
 * caller decides whether that's what the user wants. */
export async function remove(
	driver: SqlDriver,
	id: number,
	deleteOrphanedTasks: boolean
): Promise<void> {
	if (deleteOrphanedTasks) {
		await driver.execute(
			'DELETE FROM tasks WHERE subgoal_id IN (SELECT id FROM subgoals WHERE goal_id = ?1)',
			[id]
		);
	}

	const result = await driver.execute('DELETE FROM goals WHERE id = ?1', [id]);
	if (result.rowsAffected === 0) throw AppError.notFound('goal', id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/repo/goal.spec.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db/repo/goal.ts app/src/lib/db/repo/goal.spec.ts
git commit -m "feat: port goal repo to TypeScript"
```

---

### Task 15: `db/repo/completion.ts`

**Files:**
- Create: `app/src/lib/db/repo/completion.ts`
- Test: `app/src/lib/db/repo/completion.spec.ts`

**Interfaces:**
- Consumes: `SqlDriver`, `now` (Task 9).
- Produces: `set(driver, taskId, on: string, done: boolean): Promise<void>`, `datesForTask(driver, taskId, from: string, to: string): Promise<Set<string>>`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/db/repo/completion.spec.ts` (ported from `repo/completion.rs`):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as completion from './completion';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

async function seedHabit(): Promise<number> {
	const result = await driver.execute(
		"INSERT INTO tasks (title, recurrence, created_at, updated_at) VALUES ('Stretch', 'daily', datetime('now'), datetime('now'))"
	);
	return result.lastInsertId;
}

describe('completion', () => {
	it('logging the same day twice keeps one row', async () => {
		const taskId = await seedHabit();
		await completion.set(driver, taskId, '2026-07-30', true);
		await completion.set(driver, taskId, '2026-07-30', true);

		const dates = await completion.datesForTask(driver, taskId, '2026-07-30', '2026-07-30');
		expect(dates.size).toBe(1);
	});

	it('unlogging a day that was never logged is harmless', async () => {
		const taskId = await seedHabit();
		await completion.set(driver, taskId, '2026-07-30', false);

		const dates = await completion.datesForTask(driver, taskId, '2026-07-30', '2026-07-30');
		expect(dates.size).toBe(0);
	});

	it('the range is inclusive at both ends', async () => {
		const taskId = await seedHabit();
		for (const day of ['2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31']) {
			await completion.set(driver, taskId, day, true);
		}

		const found = await completion.datesForTask(driver, taskId, '2026-07-29', '2026-07-30');
		expect(found.size).toBe(2);
		expect(found.has('2026-07-29')).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/repo/completion.spec.ts`
Expected: FAIL — `./completion` does not exist.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/db/repo/completion.ts`:

```ts
import type { SqlDriver } from '../driver';
import { now } from './helpers';

/** The completion log — one row per day a recurring task was done. This is the
 * source of truth; streak counters are always derived from it, never stored. */

/** Logs or unlogs one day. Logging a day twice is a no-op rather than an error —
 * the UI toggle should be safe to double-click. */
export async function set(
	driver: SqlDriver,
	taskId: number,
	on: string,
	done: boolean
): Promise<void> {
	if (done) {
		await driver.execute(
			`INSERT INTO task_completions (task_id, completed_on, created_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT (task_id, completed_on) DO NOTHING`,
			[taskId, on, now()]
		);
	} else {
		await driver.execute(
			'DELETE FROM task_completions WHERE task_id = ?1 AND completed_on = ?2',
			[taskId, on]
		);
	}
}

export async function datesForTask(
	driver: SqlDriver,
	taskId: number,
	from: string,
	to: string
): Promise<Set<string>> {
	const rows = await driver.select<{ completed_on: string }>(
		`SELECT completed_on FROM task_completions
         WHERE task_id = ?1 AND completed_on BETWEEN ?2 AND ?3`,
		[taskId, from, to]
	);
	return new Set(rows.map((row) => row.completed_on));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/repo/completion.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db/repo/completion.ts app/src/lib/db/repo/completion.spec.ts
git commit -m "feat: port completion repo to TypeScript"
```

---

### Task 16: `db/repo/streak.ts` (assembly)

**Files:**
- Create: `app/src/lib/db/repo/streak.ts`
- Test: `app/src/lib/db/repo/streak.spec.ts`

**Interfaces:**
- Consumes: `SqlDriver`, `AppError`, `today`/`localDateOf` (Task 9), `task.listRecurring`/`task.get`/`task.isRecurring` (Task 12), `settings.graceDays` (Task 11), `completion.set`/`completion.datesForTask` (Task 15), `expectedDays`/`stateOf`/`summarize` (Task 8), `weekdayOf` (Task 6).
- Produces: `DEFAULT_CELL_DAYS = 20`, `list(driver, days): Promise<StreakCard[]>`, `setCompletion(driver, taskId, on: string | null, done: boolean, days: number): Promise<StreakCard>`.

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/db/repo/streak.spec.ts` (ported from `repo/streak.rs`):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlDriver } from '../driver';
import { createTestDriver } from '../testDriver';
import * as streak from './streak';
import * as task from './task';
import * as goal from './goal';

let driver: SqlDriver;

beforeEach(() => {
	driver = createTestDriver();
});

async function habit(title: string, recurrence: 'daily' | 'weekly' | 'weekdays') {
	return (
		await task.create(driver, {
			title,
			dueDate: null,
			goalId: null,
			subgoalId: null,
			recurrence
		})
	).id;
}

describe('streak', () => {
	it('a fresh habit has an empty streak', async () => {
		await habit('Stretch', 'daily');
		const [card] = await streak.list(driver, 20);

		expect(card.current).toBe(0);
		expect(card.longest).toBe(0);
		expect(card.doneToday).toBe(false);
		expect(card.cells).toHaveLength(20);
	});

	it('checking off today starts a streak', async () => {
		const id = await habit('Stretch', 'daily');
		const card = await streak.setCompletion(driver, id, null, true, 20);

		expect(card.current).toBe(1);
		expect(card.doneToday).toBe(true);
		expect(card.cells.at(-1)?.state).toBe('done');
	});

	it('unchecking removes the completion', async () => {
		const id = await habit('Stretch', 'daily');
		await streak.setCompletion(driver, id, null, true, 20);
		const card = await streak.setCompletion(driver, id, null, false, 20);

		expect(card.current).toBe(0);
		expect(card.doneToday).toBe(false);
	});

	it('checking off twice is idempotent', async () => {
		const id = await habit('Stretch', 'daily');
		await streak.setCompletion(driver, id, null, true, 20);
		const card = await streak.setCompletion(driver, id, null, true, 20);

		expect(card.current).toBe(1);
		const rows = await driver.select('SELECT * FROM task_completions');
		expect(rows).toHaveLength(1);
	});

	it('days before the task existed are not misses', async () => {
		await habit('Stretch', 'daily');
		const [card] = await streak.list(driver, 20);

		const notExpected = card.cells.filter((cell) => cell.state === 'not_expected').length;
		expect(notExpected).toBe(19);
	});

	it('only recurring tasks have streaks', async () => {
		const oneOff = (
			await task.create(driver, {
				title: 'Buy a notebook',
				dueDate: null,
				goalId: null,
				subgoalId: null,
				recurrence: null
			})
		).id;

		await expect(streak.setCompletion(driver, oneOff, null, true, 20)).rejects.toMatchObject({
			kind: 'validation'
		});
		expect(await streak.list(driver, 20)).toHaveLength(0);
	});

	it('listing covers every habit', async () => {
		await habit('Stretch', 'daily');
		await habit('Review the week', 'weekly');

		const titles = (await streak.list(driver, 20)).map((card) => card.task.title);
		expect(titles).toHaveLength(2);
		expect(titles).toContain('Stretch');
	});

	it('the grace setting changes the answer', async () => {
		const id = await habit('Stretch', 'daily');
		const today = new Date();
		const backdated = new Date(today);
		backdated.setDate(backdated.getDate() - 2);
		await driver.execute('UPDATE tasks SET created_at = ?1 WHERE id = ?2', [
			backdated.toISOString(),
			id
		]);
		const backdatedDate = backdated.toISOString().slice(0, 10);
		await driver.execute(
			'INSERT INTO task_completions (task_id, completed_on, created_at) VALUES (?1, ?2, ?3)',
			[id, backdatedDate, backdated.toISOString()]
		);

		await driver.execute('UPDATE settings SET streak_grace_days = 0 WHERE id = 1');
		let [card] = await streak.list(driver, 20);
		expect(card.current).toBe(0);

		await driver.execute('UPDATE settings SET streak_grace_days = 7 WHERE id = 1');
		[card] = await streak.list(driver, 20);
		expect(card.current).toBe(1);
	});

	it('habits are left out of goal progress', async () => {
		const created = await goal.create(driver, {
			categoryId: null,
			title: 'Get fit',
			description: null,
			timeframe: 'mid',
			dueDate: null,
			motivationText: null,
			motivationImagePath: null
		});

		const ordinary = (
			await task.create(driver, {
				title: 'Buy shoes',
				dueDate: null,
				goalId: created.id,
				subgoalId: null,
				recurrence: null
			})
		).id;
		await task.setStatus(driver, ordinary, 'done');
		await task.create(driver, {
			title: 'Stretch',
			dueDate: null,
			goalId: created.id,
			subgoalId: null,
			recurrence: 'daily'
		});

		expect((await goal.getDetail(driver, created.id)).progress).toBe(1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db/repo/streak.spec.ts`
Expected: FAIL — `./streak` does not exist.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/db/repo/streak.ts`:

```ts
import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { CellState, DayCell, StreakCard, Task } from '../../api/types';
import { localDateOf, today as todayFn } from './helpers';
import * as task from './task';
import * as settings from './settings';
import * as completion from './completion';
import { expectedDays, stateOf, summarize } from '../logic/streak';
import { addDays, weekdayOf, compareDates } from '../logic/dates';

/** How many trailing days the Task Manager's heatmap strip shows. */
export const DEFAULT_CELL_DAYS = 20;

/** One card per habit, in the same order task.list uses. */
export async function list(driver: SqlDriver, days: number): Promise<StreakCard[]> {
	const habits = await task.listRecurring(driver);
	const cards: StreakCard[] = [];
	for (const habit of habits) {
		cards.push(await build(driver, habit, days));
	}
	return cards;
}

/** `on = null` means today. Returns the recomputed card so the caller never has
 * to make a second round trip to see the new streak. */
export async function setCompletion(
	driver: SqlDriver,
	taskId: number,
	on: string | null,
	done: boolean,
	days: number
): Promise<StreakCard> {
	const habit = await task.get(driver, taskId);
	ensureRecurring(habit);

	await completion.set(driver, taskId, on ?? todayFn(), done);
	return build(driver, habit, days);
}

function ensureRecurring(habit: Task): void {
	if (!task.isRecurring(habit)) {
		throw AppError.validation(`task ${habit.id} is not recurring, so it has no streak`);
	}
}

/** Assembling a card without a cadence is a contradiction, not just missing
 * data — the caller already gets a validation error from ensureRecurring
 * before this ever reaches a task with no recurrence. */
async function build(driver: SqlDriver, habit: Task, days: number): Promise<StreakCard> {
	ensureRecurring(habit);
	const recurrence = habit.recurrence!;

	const today = todayFn();
	// History starts the day the habit was created: days before it existed are
	// not misses. A weekly habit's anchor is that same day's weekday.
	const created = localDateOf(habit.createdAt);
	const start = compareDates(created, today) < 0 ? created : today;
	const anchor = weekdayOf(start);
	const grace = await settings.graceDays(driver);

	const done = await completion.datesForTask(driver, habit.id, start, today);
	const expected = expectedDays(recurrence, anchor, start, today);
	const summary = summarize(expected, done, grace, today);

	const expectedSet = new Set(expected);
	const firstCell = addDays(today, -(days - 1));
	const cells: DayCell[] = [];
	for (let offset = 0; offset < days; offset += 1) {
		const day = addDays(firstCell, offset);
		const state: CellState = expectedSet.has(day) ? stateOf(day, done, grace, today) : 'not_expected';
		cells.push({ date: day, state });
	}

	return {
		task: habit,
		current: summary.current,
		longest: summary.longest,
		doneToday: done.has(today),
		cells
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db/repo/streak.spec.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/db/repo/streak.ts app/src/lib/db/repo/streak.spec.ts
git commit -m "feat: port streak card assembly to TypeScript"
```

---

### Task 17: Cut `api/index.ts` and `api/settings.ts` over to the TS backend

**Files:**
- Modify: `app/src/lib/api/index.ts`
- Modify: `app/src/lib/api/settings.ts`
- Delete: `app/src/lib/api/client.ts`

**Interfaces:**
- Consumes: `getDriver` (Task 5), every `repo/*.ts` module (Tasks 10–16), `AppError` (Task 3).
- Produces: unchanged public exports — every function name, parameter order, and return type in `api/index.ts`/`api/settings.ts` stays exactly as it is today, so no importer changes.

- [ ] **Step 1: Rewrite `api/index.ts`**

Replace the full contents of `app/src/lib/api/index.ts`:

```ts
import { getDriver } from '../db/connection';
import { AppError } from '../db/error';
import * as categoryRepo from '../db/repo/category';
import * as goalRepo from '../db/repo/goal';
import * as subgoalRepo from '../db/repo/subgoal';
import * as taskRepo from '../db/repo/task';
import * as streakRepo from '../db/repo/streak';
import type {
	Category,
	CategoryInput,
	Goal,
	GoalDetail,
	GoalInput,
	GoalStatus,
	GoalSummary,
	StreakCard,
	Subgoal,
	SubgoalInput,
	SubgoalUpdate,
	Task,
	TaskInput,
	TaskStatus,
	TaskSummary,
	TaskUpdate
} from './types';

export * from './types';
export { AppError };
export type { ErrorKind } from '../db/error';

export const listCategories = async (): Promise<Category[]> => categoryRepo.list(await getDriver());
export const createCategory = async (input: CategoryInput): Promise<Category> =>
	categoryRepo.create(await getDriver(), input);
export const updateCategory = async (id: number, input: CategoryInput): Promise<Category> =>
	categoryRepo.update(await getDriver(), id, input);
export const deleteCategory = async (id: number): Promise<void> =>
	categoryRepo.remove(await getDriver(), id);

export const listGoals = async (status: GoalStatus | null = null): Promise<GoalSummary[]> =>
	goalRepo.list(await getDriver(), status);
export const getGoal = async (id: number): Promise<GoalDetail> => goalRepo.getDetail(await getDriver(), id);
export const createGoal = async (input: GoalInput): Promise<Goal> => goalRepo.create(await getDriver(), input);
export const updateGoal = async (id: number, input: GoalInput): Promise<Goal> =>
	goalRepo.update(await getDriver(), id, input);
export const setGoalStatus = async (id: number, status: GoalStatus): Promise<Goal> =>
	goalRepo.setStatus(await getDriver(), id, status);
export const deleteGoal = async (id: number, deleteOrphanedTasks: boolean): Promise<void> =>
	goalRepo.remove(await getDriver(), id, deleteOrphanedTasks);

export const listSubgoals = async (): Promise<Subgoal[]> => subgoalRepo.listAll(await getDriver());
export const createSubgoal = async (input: SubgoalInput): Promise<Subgoal> =>
	subgoalRepo.create(await getDriver(), input);
export const updateSubgoal = async (id: number, input: SubgoalUpdate): Promise<Subgoal> =>
	subgoalRepo.update(await getDriver(), id, input);
export const setSubgoalComplete = async (id: number, isComplete: boolean): Promise<Subgoal> =>
	subgoalRepo.setComplete(await getDriver(), id, isComplete);
export const deleteSubgoal = async (id: number): Promise<void> =>
	subgoalRepo.remove(await getDriver(), id);

export const listTasks = async (): Promise<TaskSummary[]> => taskRepo.list(await getDriver());
export const createTask = async (input: TaskInput): Promise<Task> => taskRepo.create(await getDriver(), input);
export const updateTask = async (id: number, input: TaskUpdate): Promise<Task> =>
	taskRepo.update(await getDriver(), id, input);
export const setTaskStatus = async (id: number, status: TaskStatus): Promise<Task> =>
	taskRepo.setStatus(await getDriver(), id, status);
export const deleteTask = async (id: number): Promise<void> => taskRepo.remove(await getDriver(), id);

export const listStreaks = async (days?: number): Promise<StreakCard[]> =>
	streakRepo.list(await getDriver(), days ?? streakRepo.DEFAULT_CELL_DAYS);
/** `date` is a local `YYYY-MM-DD`; omit it to mean today. */
export const setTaskCompletion = async (
	id: number,
	done: boolean,
	date: string | null = null
): Promise<StreakCard> => streakRepo.setCompletion(await getDriver(), id, date, done, streakRepo.DEFAULT_CELL_DAYS);
```

- [ ] **Step 2: Rewrite `api/settings.ts`**

Replace the full contents of `app/src/lib/api/settings.ts`:

```ts
import { getDriver } from '../db/connection';
import * as settingsRepo from '../db/repo/settings';
import type { Settings } from './types';

export const getSettings = async (): Promise<Settings> => settingsRepo.get(await getDriver());
export const setActiveTheme = async (theme: string): Promise<Settings> =>
	settingsRepo.setTheme(await getDriver(), theme);
export const setStreakGraceDays = async (days: number): Promise<Settings> =>
	settingsRepo.setGraceDays(await getDriver(), days);
```

- [ ] **Step 3: Delete the old IPC client**

```bash
git rm app/src/lib/api/client.ts
```

- [ ] **Step 4: Type-check and run the unit suite**

Run: `npm run check` (from `app/`)
Expected: no errors — every importer of `AppError`/`ErrorKind` goes through `$lib/api`, which still re-exports both.

Run: `npx vitest run`
Expected: every spec from Tasks 3–16 still passes (nothing about them changed), plus the pre-existing `format.spec.ts`.

- [ ] **Step 5: Manual smoke test**

Run: `npm run tauri dev` (from `app/`)
Expected: the app opens, existing goals/tasks/streaks load, and creating a goal/task and toggling a streak all work — this is the first time the TS backend is live end to end.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/api/index.ts app/src/lib/api/settings.ts
git commit -m "feat: cut api layer over to the TypeScript backend"
```

---

### Task 18: Delete the old Rust backend

**Files:**
- Delete: `app/src-tauri/src/commands.rs`
- Delete: `app/src-tauri/src/repo/` (entire directory)
- Delete: `app/src-tauri/src/streak.rs`
- Delete: `app/src-tauri/src/progress.rs`
- Delete: `app/src-tauri/src/models.rs`
- Delete: `app/src-tauri/src/error.rs`
- Delete: `app/src-tauri/src/db/` (entire directory)
- Modify: `app/src-tauri/src/lib.rs`
- Modify: `app/src-tauri/Cargo.toml`
- Modify: `app/package.json` (remove `test:rust` if no Rust tests remain — see Step 3)

**Interfaces:** none — this is pure deletion; nothing downstream depends on these files after Task 17.

- [ ] **Step 1: Delete the old modules**

```bash
git rm app/src-tauri/src/commands.rs app/src-tauri/src/streak.rs app/src-tauri/src/progress.rs app/src-tauri/src/models.rs app/src-tauri/src/error.rs
git rm -r app/src-tauri/src/repo app/src-tauri/src/db
```

- [ ] **Step 2: Rewrite `lib.rs`**

Replace `app/src-tauri/src/lib.rs` with:

```rust
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

/// Connection string shared with the JS side (`app/src/lib/db/connection.ts`) —
/// tauri-plugin-sql keys registered migrations by this exact string, so it must
/// match on both sides verbatim.
const SQL_CONNECTION: &str = "sqlite:mushpoint.sqlite3";

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "streaks",
            sql: include_str!("../migrations/0002_streaks.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(SQL_CONNECTION, migrations())
                .build(),
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Note `app.manage(db::Db::new(...))` and the `invoke_handler(command_handlers!())` call are both gone — there are no custom commands left to register, and the SQLite connection is now owned entirely by the plugin.

- [ ] **Step 3: Prune `Cargo.toml`**

Edit `app/src-tauri/Cargo.toml`, removing the `rusqlite`, `chrono`, and `thiserror` lines from `[dependencies]` — nothing left in `lib.rs` uses them. Keep `serde`, `serde_json`, `log`, `tauri`, `tauri-plugin-log`, `tauri-plugin-sql`, and the `[build-dependencies]` section unchanged.

- [ ] **Step 4: Verify Rust still builds**

Run: `cargo build --manifest-path app/src-tauri/Cargo.toml`
Expected: builds clean.

Run: `cargo test --manifest-path app/src-tauri/Cargo.toml`
Expected: `0 tests run` (or very close to it) — every test that used to live here has a TS counterpart from Tasks 6–16. If `npm run test` still calls `test:rust`, leave the script in `package.json`; a 0-test pass is a legitimate, harmless result and keeping the script means a future Rust addition is covered automatically.

- [ ] **Step 5: Run the full verification suite**

Run: `npm run check` (from `app/`)
Expected: no errors.

Run: `npx vitest run`
Expected: all specs pass.

Run: `npm run test:e2e` (from `app/`)
Expected: the existing Playwright suite passes against the app now running entirely on the TS backend.

- [ ] **Step 6: Manual smoke test**

Run: `npm run tauri dev`
Expected: full walkthrough — create a category, a goal, a subgoal, a task, toggle a habit's streak, change the theme and grace days in Settings, delete a goal with and without orphaning its tasks. Everything behaves exactly as it did before this migration.

- [ ] **Step 7: Commit**

```bash
git add app/src-tauri/src/lib.rs app/src-tauri/Cargo.toml app/src-tauri/Cargo.lock
git commit -m "feat: remove the old Rust backend now that TypeScript owns it"
```

---

## Self-Review Notes

- **Spec coverage:** every decision row in the spec maps to a task — architecture (Tasks 1, 17–18), file layout (Tasks 3–16), data flow (Task 17), error handling (Task 3), migrations (Task 1, 18), testing strategy (Tasks 4, 6–16), cutover order (Tasks 17–18).
- **Deviation from spec, called out explicitly:** the spec named `better-sqlite3` for the test driver; Task 4 uses `node:sqlite`'s `DatabaseSync` instead, because `better-sqlite3` failed to compile in this environment (verified, see spec amendment). Functionally equivalent, zero extra dependency, no native build step.
- **Type consistency check:** `SqlDriver`/`QueryResult` (Task 3) are used with identical shapes in `pluginSqlDriver.ts` (Task 5) and `testDriver.ts` (Task 4). `AppError.notFound`/`AppError.validation` signatures (Task 3) are used identically across every repo file (Tasks 10–16). `Task.recurrence`/`isRecurring`/`countsTowardProgress`/`taskCompletion` (Tasks 7, 12) are consumed with matching signatures in `subgoal.ts`, `goal.ts`, and `streak.ts` (Tasks 13, 14, 16). Every repo function's parameter order (`driver` first) is consistent everywhere it's called from another repo file or from `api/index.ts`.
- **No placeholders:** every task has complete, non-abbreviated code — including every ported Rust test case — rather than references to "similar to Task N."
