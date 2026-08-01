# Backend Migration — Rust to TypeScript

**Status:** approved 2026-08-01

## Goal

The backend logic today lives in Rust (`app/src-tauri/src/`): IPC command handlers, per-entity
SQL repositories, and pure business logic (progress math, streak math), all against `rusqlite`.
This phase moves everything except the SQLite connection itself into TypeScript, so day-to-day
maintenance happens in one language. Rust shrinks to plugin registration and schema migrations —
there is no more custom command or query logic on the Rust side.

Motivation: single-language maintenance. Not chasing performance or a future web port.

## Decisions

| Question | Decision |
|---|---|
| Rollout style | Big-bang on one branch. Old and new can't sensibly coexist since both would own the same SQLite file through different access paths. |
| How does TS reach SQLite? | `@tauri-apps/plugin-sql` (official plugin). TS calls `.select()`/`.execute()`; Rust only registers the plugin and its migrations. |
| Where do schema migrations live? | Rust (`lib.rs`), as `tauri_plugin_sql::Migration` entries ported near-verbatim from today's `db/migrations.rs`. They're DDL, not business logic — the one place a straight port makes sense. |
| Where does business logic live? | TypeScript: `app/src/lib/db/repo/*.ts` (SQL + rules, mirrors today's `repo/*.rs`) and `app/src/lib/db/logic/*.ts` (pure functions, mirrors `streak.rs`/`progress.rs`). |
| Does the UI change? | No. `app/src/lib/api/index.ts` and `api/settings.ts` keep their exact exported function signatures; only their implementation swaps from `invoke()` to direct repo calls. |
| How is the SQL layer unit tested? | Through a thin `SqlDriver` interface (`select`, `execute`) with two implementations: `pluginSqlDriver.ts` (real app) and `testDriver.ts` (`better-sqlite3`, in-memory, vitest-only). Repo functions depend on the interface, never a concrete driver — mirrors how Rust repo functions took `&Connection`. |
| What happens to `client.ts`? | Deleted. There's no IPC boundary left for data calls, so no `invoke()` wrapper or JSON error reconstruction is needed. |
| What happens to existing Rust tests? | Every `#[cfg(test)]` case in `streak.rs`, `progress.rs`, and `repo/*.rs` is ported 1:1 into vitest specs with the same fixture values, so coverage doesn't regress. |

## 1. Architecture

`app/src-tauri/src/` shrinks to `main.rs` + `lib.rs`. `lib.rs` registers `tauri-plugin-sql` (with
the migration list) and `tauri-plugin-log`, and points the plugin at the same
`mushpoint.sqlite3` file in the per-OS app data dir it uses today. Deleted entirely: `commands.rs`,
`repo/`, `streak.rs`, `progress.rs`, `models.rs`, `error.rs`, `db/`. `Cargo.toml` drops
`rusqlite`, `chrono`, `thiserror`; adds `tauri-plugin-sql` (sqlite feature). `package.json` adds
`@tauri-apps/plugin-sql`.

`app/src/lib/db/` becomes the backend. `app/src/lib/api/` is the one and only consumer-facing
surface — every Svelte route and component already imports from there, so this migration is
invisible above that layer.

## 2. File layout

```
app/src/lib/db/
  driver.ts          — SqlDriver interface: select<T>(sql, params), execute(sql, params)
  pluginSqlDriver.ts — real implementation, wraps @tauri-apps/plugin-sql
  testDriver.ts      — vitest-only implementation, wraps better-sqlite3 (in-memory)
  connection.ts      — loads the right driver, singleton
  error.ts           — AppError (kind: not_found | validation | database | internal)
  repo/
    category.ts   goal.ts   subgoal.ts   task.ts   settings.ts   completion.ts   streak.ts
  logic/
    streak.ts    — pure: expectedDays / stateOf / summarize (ported from streak.rs)
    progress.ts  — pure: average / subgoalProgress / goalProgress (ported from progress.rs)
```

`app/src/lib/api/client.ts` is deleted. `api/types.ts` is unaffected — it already mirrors the
`models.rs` structs field-for-field and becomes the source of truth once `models.rs` is gone.

## 3. Data flow

Example — `createGoal(input)`:

`api/index.ts createGoal(input)` → `db/repo/goal.ts createGoal(driver, input)`:
validates the title is non-blank (throws `AppError.validation`), checks `categoryId` exists if
given (`repo/category.ts get`, throws `AppError.notFound`), runs `driver.execute(INSERT ...)`
with bound params, then `driver.select(SELECT ... WHERE id = ?)` for the inserted row, returns a
typed `Goal`. Same shape as today's `repo::goal::create`, minus the JSON round-trip — it's one
JS call stack now (plugin-sql still crosses into Rust internally to touch the file, but that's
invisible to application code).

Example — `listGoals()`: `goal.list(driver, status)` selects goal rows, then for each one calls
`subgoal.progressesForGoal` and `task.listDirectForGoal`, and computes progress via
`logic/progress.ts goalProgress` — identical structure to `repo::goal::list` today.

## 4. Error handling

One `AppError` class in `db/error.ts`, thrown directly by repo functions and consumed as-is by
`api/*` and UI error handling. No serialize-in-Rust/reconstruct-in-TS step, since there's no
process boundary between where the error is thrown and where it's caught.

## 5. Migrations

Stay Rust-side, ported near-verbatim from `db/migrations.rs` into `tauri_plugin_sql::Migration`
entries (one per existing `M0001_INITIAL` / `M0002_STREAKS` string). Append-only, same as today —
a new migration is a new list entry, never an edit to a shipped one.

The `testDriver.ts` path needs the same DDL to build its in-memory schema, so the migration SQL
is duplicated as TS string constants for tests only. Accepted tradeoff: the DDL changes rarely
and is append-only, so drift risk is low; if this becomes a real pain point later, revisit by
generating one from the other.

## 6. Testing

- `logic/streak.ts` / `logic/progress.ts`: plain vitest, no driver involved. Every existing Rust
  test case (grace-window edges, pending-vs-missed, weekly anchor, longest-vs-current, etc.) is
  ported with the same fixture dates and expected values.
- `repo/*.ts`: vitest against `testDriver.ts` (`better-sqlite3`, in-memory, migrations applied
  once per test) — same pattern as today's `db::open_in_memory()` tests, including the
  validation/not-found/cascade-delete cases already covered in `repo/goal.rs` and friends.
- The existing Playwright e2e plan (`docs/plans/playwright-test-plan.md`) continues to exercise
  the real `plugin-sql` path end-to-end and is unaffected by this migration.

## 7. Cutover sequence (big-bang)

High-level order; exact tasks belong in the implementation plan, not here.

1. Add `tauri-plugin-sql` (Rust + JS) and port the migration list into `lib.rs`.
2. Build `db/driver.ts` and both driver implementations.
3. Port `logic/streak.ts` and `logic/progress.ts` with their tests.
4. Port `repo/*.ts` one entity at a time, each with its ported test suite.
5. Swap `api/index.ts` and `api/settings.ts` to call repo functions instead of `invoke()`.
6. Delete the old Rust modules (`commands.rs`, `repo/`, `streak.rs`, `progress.rs`, `models.rs`,
   `error.rs`, `db/`) and `api/client.ts`.
7. Run the full vitest suite, the Playwright suite, and a manual smoke pass of the app.
