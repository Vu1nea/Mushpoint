# Mushpoint

Desktop goal tracker: Tauri (Rust) + SvelteKit + Tailwind v4 + SQLite, local-first.
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
npm run test:unit     # vitest — formatting/date helpers
npm run test:rust     # cargo test — schema, repos, progress rule (39 tests)
npm run test:e2e      # playwright — app shell against the plain web build
npm run test          # all three
npm run check         # svelte-check
```

The Rust tests run against an in-memory SQLite database, so they exercise the
real schema and the real queries without touching the app's data file.

## Layout

```
src/lib/api/          typed wrappers over the Tauri commands (camelCase in, AppError out)
src/lib/theme/        active theme store, persisted to SQLite and mirrored to localStorage
src/lib/icons/        logical icon names resolved per theme
src/lib/styles/       theme tokens; every color in the UI comes from here
src/lib/components/   Icon, ProgressBar, SubgoalCard, TaskRow, error/empty states
src/routes/           /goals, /goals/[id], /settings
src-tauri/src/db/     connection setup and versioned migrations
src-tauri/src/repo/   all SQL, one module per entity
src-tauri/src/progress.rs   the plan's progress rule, as pure functions
src-tauri/src/commands.rs   the IPC surface
```

## Things worth knowing

- **Where the data lives:** `%APPDATA%/com.mushpoint.app/mushpoint.sqlite3` on
  Windows, `~/Library/Application Support/com.mushpoint.app/` on macOS. One file,
  copy it to back it up.
- **Migrations** are an append-only list in `src-tauri/src/db/migrations.rs`,
  tracked with `PRAGMA user_version`. Never edit a migration that has shipped.
- **Progress is derived, never stored.** A goal averages its direct children —
  subgoals and directly-linked tasks weigh the same, and a subgoal's own value is
  the average of its tasks. Tasks count only when `done`; `in_progress` is 0.
- **Status is not progress.** Completing or archiving a goal is an explicit user
  action, so progress can sit at 100% while the goal stays active.
- **Themes** are CSS custom properties in `src/lib/styles/theme.css` mapped to
  Tailwind utilities (`bg-surface`, `text-muted`, …). Adding a theme means adding
  one block there, one entry in `THEMES`, and one in the backend's allow-list.
  Components must not hardcode colors.
