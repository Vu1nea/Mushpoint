# Mushpoint

Desktop goal tracker: Tauri (Rust shell) + SvelteKit (TypeScript backend) + Tailwind v4 +
SQLite, local-first. Backend logic (repos, progress math, streak math) lives in TypeScript
under `src/lib/db/`, talking to SQLite through `@tauri-apps/plugin-sql`. Rust is now only
the app shell and schema migrations — see
[`../docs/superpowers/specs/2026-08-01-ts-backend-migration-design.md`](../docs/superpowers/specs/2026-08-01-ts-backend-migration-design.md)
for why and [`../docs/superpowers/plans/2026-08-01-ts-backend-migration.md`](../docs/superpowers/plans/2026-08-01-ts-backend-migration.md)
for how.
Plan of record: [`../plans/goal_tracker_plan.md`](../plans/goal_tracker_plan.md).

Phases 0 and 1 are built: the app shell, theming system, database with migrations,
and CRUD plus progress for Goals, Categories, Subgoals and Tasks. Task Manager,
Streaks, Projects, Ideas, Vision Board and the Dashboard are later phases.

## Running it

```sh
npm install
npm run tauri dev     # the app itself — starts Vite and the Rust shell together
```

`npm run dev` alone serves the UI in a browser, where no backend exists — every
screen then shows a "Backend not running" banner. That is expected, not a bug.

```sh
npm run tauri build   # installer for the current OS (unsigned)
```

## Tests

```sh
npm run test:unit     # vitest — formatting/date helpers, and every repo/logic module
npm run test:rust     # cargo test — the one-time old-database compatibility shim only
npm run test:e2e      # playwright — app shell against the plain web build, backend absent
npm run test          # all three
npm run check         # svelte-check
```

The repo/logic tests run against an in-memory `node:sqlite` database built from
`src/lib/db/testSchema.ts`, so they exercise the real schema and the real queries
without touching the app's data file. **They do not exercise the real
`@tauri-apps/plugin-sql` connection** — that only runs inside an actual `npm run
tauri dev`/build, since it needs the Tauri IPC bridge. The Playwright suite
currently runs against the plain web build (no Tauri backend at all — see its
own header comment), so it does not cover the real SQL path either. A manual
`npm run tauri dev` pass is still the only thing that exercises
`pluginSqlDriver.ts`, `connection.ts`, and the Rust-side migrations for real.

## Layout

```
src/lib/api/          the one interface routes/components use (camelCase in, AppError out)
src/lib/db/           the backend: SQL repos, progress/streak math, the SqlDriver seam
src/lib/db/repo/      all SQL, one module per entity — mirrors the old src-tauri/src/repo/
src/lib/db/logic/     pure progress/streak math, no I/O — mirrors the old progress.rs/streak.rs
src/lib/theme/        active theme store, persisted to SQLite and mirrored to localStorage
src/lib/icons/        logical icon names resolved per theme
src/lib/styles/       theme tokens; every color in the UI comes from here
src/lib/components/   Icon, ProgressBar, SubgoalCard, TaskRow, error/empty states
src/routes/           /goals, /goals/[id], /settings
src-tauri/migrations/ the two shipped schema migrations, applied by tauri-plugin-sql
src-tauri/src/lib.rs  plugin registration only — no custom commands, no business logic
src-tauri/src/db_baseline.rs   one-time compatibility shim for databases predating this migration
```

## Things worth knowing

- **Where the data lives:** `tauri-plugin-sql` resolves the connection string
  against `app_config_dir()`, which is `%APPDATA%/com.mushpoint.app/mushpoint.sqlite3`
  on Windows and `~/Library/Application Support/com.mushpoint.app/` on macOS — the
  same directory `app_data_dir()` resolves to on both platforms, so this is
  unchanged from before this migration. On Linux the two directories differ
  (`~/.config` vs `~/.local/share`); this hasn't been exercised on Linux yet.
  One file, copy it to back it up.
- **Migrations** are two SQL files in `src-tauri/migrations/`, registered as
  `tauri_plugin_sql::Migration` entries in `src-tauri/src/lib.rs`. Never edit a
  migration that has shipped — append a new one instead, exactly as before.
  Tracking changed with this migration too: it used to be `PRAGMA user_version`;
  now `tauri-plugin-sql` (via `sqlx`) tracks applied migrations in a
  `_sqlx_migrations` table inside the database itself. A database created by the
  pre-TypeScript app has neither that table nor any bookkeeping sqlx recognizes —
  `src-tauri/src/db_baseline.rs` runs once at startup, before the frontend can
  call `Database.load()`, and backfills `_sqlx_migrations` (with a `.bak` copy
  taken first) so sqlx sees both shipped migrations as already applied instead of
  replaying them against tables that already exist.
- **The `SqlDriver` seam** (`src/lib/db/driver.ts`) is what makes the repo layer
  testable: `pluginSqlDriver.ts` wraps the real `@tauri-apps/plugin-sql`
  connection; `testDriver.ts` wraps Node's built-in `node:sqlite` for vitest.
  Every `src/lib/db/repo/*.ts` function takes a driver as its first argument and
  never imports a concrete one.
- **Progress is derived, never stored.** A goal averages its direct children —
  subgoals and directly-linked tasks weigh the same, and a subgoal's own value is
  the average of its tasks. Tasks count only when `done`; `in_progress` is 0.
- **Status is not progress.** Completing or archiving a goal is an explicit user
  action, so progress can sit at 100% while the goal stays active.
- **Themes** are CSS custom properties in `src/lib/styles/theme.css` mapped to
  Tailwind utilities (`bg-surface`, `text-muted`, …). Adding a theme means adding
  one block there, one entry in `THEMES`, and one in the backend's allow-list.
  Components must not hardcode colors.
