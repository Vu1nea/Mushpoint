# Mushpoint

Goal, task, habit-streak and vision-board tracker. Two packages, no workspace tooling:

- `app/`: SvelteKit SPA (static adapter), served by nginx in production. UI kit is the
  separate `mushpoint-design` package, pinned by git commit in `app/package.json`.
- `server/`: Express 5 JSON API on Postgres (Supabase-hosted in production). Auth is a
  Supabase access token checked with JWKS; every query runs inside a per-user transaction
  under row-level security (`src/db/scope.ts`, role `mushpoint_app`, `NOBYPASSRLS`).

`TODO.md` is the production-readiness checklist; tick items there when they land.
`graphify-out/` holds a knowledge graph of the repo (`GRAPH_REPORT.md`); use it to find
where things live, and run `graphify update .` after large changes.

## Branch flow

`feature/*` -> PR -> `dev` -> PR -> `main`. Branch from `dev`; never push or open a PR
straight to `main`. CI on `dev` (incl. E2E) is the test environment. Only the user merges
`dev` into `main`, with a merge commit. Details in `docs/ci-cd.md`.

## Commands

Server (`cd server`): `npm run db:up` (Postgres in Docker on 54329; tests need it),
`npm test`, `npm run check`, `npm run build`, `npm run openapi`, `npm run postman`.

App (`cd app`): `npm run check`, `npm run lint` (prettier), `npm test` (unit),
`npm run test:e2e` (Playwright, needs a Supabase test project, see `app/README.md`).

Pre-commit secret scan: `git config core.hooksPath .githooks` once per clone. A false
positive goes in `.gitleaksignore` by fingerprint; don't bypass the hook.

On Windows, Vitest workers sometimes die with `0xC0000409`; rerun, CI on Linux is the
source of truth.

## Rules that are easy to break

- `server/src/types.ts` and `app/src/lib/api/types.ts` must stay byte-identical
  (`types.spec.ts` checks it).
- New route: add a zod schema in `server/src/schemas.ts` and read input only through
  `c.body(schema)` / `c.query(schema)`; add it to `OPERATIONS` in `server/src/openapi.ts`
  and run `npm run openapi`; add a step to `FOLDERS` in `server/src/postman.ts` and run
  `npm run postman`; add an `:id` route to the IDOR sweep in
  `server/src/routes/idor.spec.ts`.
- Schemas check shape only. Meaning (trim, empty, `MAX_TEXT`, http(s) URLs, ownership of
  image paths via `isOwnImagePath`) lives in `server/src/repo/` or the route.
- Another user's record must answer 404, never 403.
- Never log headers, query strings or tokens (`server/src/logger.ts`).
- Accent-colored text uses `text-accent-ink`, not `text-accent` (WCAG contrast).
- Migrations only add; apply them before deploying a server that needs them.
