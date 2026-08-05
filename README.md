# Mushpoint

Mushpoint is a desktop goal tracker: goals break down into subgoals and tasks,
recurring tasks build habit streaks, project-style goals get a Kanban view,
and a quick-capture inbox holds ideas that aren't fully formed yet. It's
local-first — everything lives in a single SQLite file on disk, with no
account and no server.

**Stack:** Tauri (Rust shell) + SvelteKit (TypeScript) + Tailwind v4 + SQLite.
Most of the application logic — repositories, progress calculation, streak
calculation — lives in TypeScript under `app/src/lib/db/`. Rust is
responsible for the webview shell and schema migrations.

## Repo layout

```
app/    the SvelteKit + Tauri app itself — see app/README.md for how to run it
docs/   design specs, plans, bug log
TODO.md near-term work
```

## Running it

```sh
cd app
npm install
npm run tauri dev
```

This starts Vite and the Rust shell together. `app/README.md` covers tests,
the project layout, and where the data file lives.

## Data model

- **Goals** are the top-level entity — short/mid/long term, with an optional
  due date. Progress isn't set directly; it's averaged from whatever
  subgoals and tasks are attached to the goal.
- **Subgoals** sit under a goal, one level deep — comparable to OKR key
  results.
- **Tasks** are the unit of work, moving through `todo` → `in_progress` →
  `done`. A task marked recurring feeds a streak counter.
- **Kanban** isn't a separate entity — it's a view over a goal's tasks.
- **Ideas** hold anything that isn't a goal yet; they can be promoted to a
  goal once they take shape.

The full design, including the reasoning behind these decisions, is in
[`docs/plans/goal_tracker_plan.md`](docs/plans/goal_tracker_plan.md).

## Current status

Goals, categories, subgoals, and tasks are implemented, along with the app
shell, theming, the database with migrations, and CRUD plus progress
calculation. Still outstanding: the Task Manager view, Streaks, Ideas, the
Vision Board, and the Dashboard. [`TODO.md`](TODO.md) has the near-term work,
and [`docs/BUG-LOG.md`](docs/BUG-LOG.md) tracks known issues.
