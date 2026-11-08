# Hosted Mushpoint (phases 1-3) Implementation Plan

> **This file is the roadmap/outline.** Each phase gets its own detailed plan; where they differ, the phase plan wins. Phase 1: `2026-11-06-phase-1-api-server.md` (written). Phases 2 and 3 are still outline-level here and will each get a detailed plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A multi-user Mushpoint: an Express API backed by Postgres with Supabase auth, a browser build of the existing UI that uses it, and Kubernetes manifests that run both on a local cluster.

**Architecture:** New `server/` package (Express 5 + `pg`) holds the repos and logic ported from `app/src/lib/db/`, Postgres-only. Isolation is Postgres row-level security: each request runs in one transaction that sets `app.user_id`, so repo SQL needs no per-query user filter. The existing SvelteKit app gets a second build target (`web`) whose `$lib/api` is an HTTP client; the Tauri build is untouched. Ingress serves web at `/` and API at `/api` on one origin.

**Tech Stack:** Node 24, TypeScript, Express 5, `pg`, `jose`, `multer`, Vitest + `supertest`, Postgres 16 (docker compose for dev/tests); web side: `@supabase/supabase-js`, nginx; Docker, kubectl + kind + ingress-nginx.

**Spec:** `docs/superpowers/specs/2026-11-06-hosted-server-design.md`. Phase 4 (cloud cluster, domain, HTTPS) is deliberately not in this plan; it gets its own plan once a provider is chosen.

## Global Constraints

- Server is TypeScript on Node 24 with Express 5 (async handlers may throw; rejections reach the error middleware). Repos are **Postgres-only**; `app/` Tauri/SQLite code is not modified except the additive web target in Tasks 12-14.
- `server/src/types.ts` is a **byte-identical copy** of `app/src/lib/api/types.ts`. The extra field the API adds (`imageUrl`) lives in a separate view type, never in the copied file.
- Owner key is `user_id uuid` (Supabase user id). No users table, no FK to `auth.users`.
- Auth: `Authorization: Bearer <Supabase access token>`, verified against the project's JWKS. The API has no auth endpoints. Browser signs up / logs in with supabase-js.
- RLS is the enforced isolation. The API connects as the non-owner role `mushpoint_app`, never `postgres` or the Supabase service role. No policies for `anon` / `authenticated`.
- Every request carries `X-Timezone` (IANA). "Today" and local dates come from it, never from the server clock. Missing/invalid header on a route that needs it → 400.
- Images: private Supabase Storage bucket `vision`, object path `<userId>/<uuid><ext>`, returned to clients as short-lived signed URLs.
- Rate limiting is at the ingress plus Supabase's own auth limits; none in the API process.
- All errors are JSON `{ "kind": ErrorKind, "message": string }`; status 400 validation (including malformed JSON bodies), 401 unauthenticated, 404 not_found, 500 otherwise.
- API is mounted under `/api`; one origin via ingress, so no CORS.
- Secrets (Supabase keys, DB passwords) never committed; manifests ship `*.example.yaml` only.

## Review Focus

Each line below has its test in the task named.

1. User B requests, updates or deletes user A's record by id → 404, never data; and creating a task with user A's `goalId`/`subgoalId` fails (Task 6, Task 9).
2. Missing, malformed, expired, wrong-issuer or forged-signature token → 401 and no database work (Task 8).
3. Two simultaneous first requests from a brand-new user produce exactly 5 default categories and one settings row (Task 3).
4. A server running in UTC serving a user at `Pacific/Kiritimati` or `Pacific/Pago_Pago` computes streak "today" in the user's zone; bad timezone → 400 (Task 5).
5. Image upload with wrong type, empty body or oversize → 400; a path outside the caller's `<userId>/` prefix is never signed; deleting a vision item removes its object (Task 10).
6. Category names are unique per user (case-sensitive, as before) and tag names case-insensitively per user, not globally; two users may both own "Work" (Task 2, Task 6).
7. The server's API types never drift from the web client's (Task 4 byte-identity test).

---

## Phase 1 - API server

### Task 1: Server scaffold and Postgres test harness

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/docker-compose.yml`, `server/.env.example`, `server/src/db/pool.ts`, `server/src/db/pool.spec.ts`
- Modify: `.gitignore` (ignore `server/node_modules`, `server/dist`, `server/.env`)

**Interfaces:**
- Produces: `createPool(connectionString: string): Pool` in `server/src/db/pool.ts` (also calls `types.setTypeParser(20, Number)` so `bigint` ids arrive as numbers); npm scripts `dev` (tsx watch), `build`, `test`, `migrate`, `db:up`, `db:down`.

- [ ] **Step 1:** Compose file runs `postgres:16` on port 54329 with superuser `postgres`; `.env.example` documents `DATABASE_URL` (app role), `MIGRATE_DATABASE_URL` (owner), `MUSHPOINT_APP_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PORT`. Vitest `globalSetup` loads `.env` defaults pointing at the compose database.
- [ ] **Step 2: Write failing test** `pool.spec.ts`: `createPool(process.env.MIGRATE_DATABASE_URL!)` then `SELECT 1 AS n` returns `[{ n: 1 }]`.
- [ ] **Step 3:** `cd server && npm run db:up && npm test` → FAIL (no `createPool`).
- [ ] **Step 4:** Implement `createPool`. `npm test` → PASS. Commit `feat(server): scaffold with postgres test harness`.

### Task 2: Schema, RLS and migration runner

**Files:**
- Create: `server/src/db/migrations/0001_init.sql`, `server/src/db/migrate.ts`, `server/src/db/migrate.spec.ts`, `server/src/db/rls.spec.ts`

**Interfaces:**
- Consumes: `createPool`.
- Produces: `migrate(connectionString: string, appPassword?: string): Promise<void>` (applies `*.sql` in filename order, records them in `schema_migrations`, idempotent; sets the `mushpoint_app` password when given); CLI `npm run migrate` reading `MIGRATE_DATABASE_URL` and `MUSHPOINT_APP_PASSWORD`; role `mushpoint_app` created by the migration.

- [ ] **Step 1: Write failing tests.**
  - `migrate.spec.ts`: running `migrate` twice does not throw and leaves one `schema_migrations` row per file.
  - `rls.spec.ts` (connects as `mushpoint_app`): (a) in a transaction with `set_config('app.user_id', A, true)`, inserting a category yields a row whose `user_id` is `A` without specifying it; (b) with `app.user_id = B` that row is invisible to `SELECT`, and `UPDATE`/`DELETE` affect 0 rows; (c) with no `app.user_id` set, any `SELECT` on a user table throws; (d) two users can each have a category named `Work`, and `Work`/`work` collide only within one user (SQLSTATE 23505).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Write `0001_init.sql`.** Same tables/columns/checks as the final state of `app/src-tauri/migrations/0001-0005` (including `recurrence`, `repo_url`, `streak_grace_days`) with these differences, all pinned here:
  - every table gets `user_id uuid NOT NULL DEFAULT current_setting('app.user_id')::uuid`; `idea_tag_links` too;
  - `id` columns become `bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`;
  - timestamps and dates stay `text` (repos format them); boolean-ish columns stay `integer`;
  - `settings` primary key is `user_id` (drop `id` and `CHECK (id = 1)`); no seed rows; no seeded categories (Task 3 does that per user);
  - uniqueness: `categories (user_id, lower(name))`, `idea_tags (user_id, lower(name))` as unique indexes; `task_completions (task_id, completed_on)` unchanged;
  - `ENABLE` and `FORCE ROW LEVEL SECURITY` on all tables; one policy per table `USING (user_id = current_setting('app.user_id')::uuid)`;
  - `CREATE ROLE mushpoint_app LOGIN NOBYPASSRLS` (guarded), `GRANT SELECT, INSERT, UPDATE, DELETE` on tables and `USAGE` on sequences.
- [ ] **Step 4:** Implement `migrate`. **Step 5:** Run → PASS. Commit `feat(server): schema with row-level security`.

### Task 3: Postgres driver and per-user scope

**Files:**
- Create: `server/src/db/driver.ts` (copy of `app/src/lib/db/driver.ts`), `server/src/db/pgDriver.ts`, `server/src/db/scope.ts`, `server/src/db/testDriver.ts`, `server/src/db/scope.spec.ts`

**Interfaces:**
- Consumes: `Pool`, schema from Task 2.
- Produces:
  - `createPgDriver(client: PoolClient): SqlDriver` — translates `?N` placeholders to `$N`; `execute` returns `lastInsertId` from a `RETURNING id` row when present (else `0`) and `rowsAffected` from the command tag; unique violations surface with Postgres' message (contains "unique"), which the ported repos already map.
  - `withUser<T>(pool: Pool, userId: string, fn: (driver: SqlDriver) => Promise<T>): Promise<T>` — one transaction: `BEGIN`, `set_config('app.user_id', userId, true)`, `bootstrapUser`, `fn`, `COMMIT` (`ROLLBACK` on throw). Rejects a non-UUID `userId` before touching the database.
  - `bootstrapUser(driver: SqlDriver): Promise<void>` — idempotent: inserts the settings row (`active_theme 'nocturne'`, `streak_grace_days 2`) and the five default categories (Work/accent-primary, Gym/accent-secondary, School/accent-tertiary, Side Projects/accent-primary, Social/accent-secondary, `is_default = 1`) only if the user has no settings row; safe under concurrent first calls via `pg_advisory_xact_lock` keyed on the user id.
  - test helper `createTestDriver(): Promise<{ driver: SqlDriver; userId: string; release(): Promise<void> }>` — fresh random user, bootstrapped, inside a transaction that `release` rolls back.

- [ ] **Step 1: Write failing tests** in `scope.spec.ts`: placeholder translation (`SELECT ?1::int + ?2::int` with `[1, 2]` → 3); `lastInsertId` from `INSERT ... RETURNING id`; `withUser` bootstraps exactly 5 categories and 1 settings row; **two parallel `withUser` calls for one new user still yield 5 categories and 1 settings row** (Review Focus 3); a thrown error rolls back; non-UUID id rejects.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS. Commit `feat(server): pg driver and per-user scope`.

### Task 4: Port errors, types and pure logic

**Files:**
- Create (copy from `app/src/lib/`, then fix imports): `server/src/error.ts` (from `db/error.ts`), `server/src/types.ts` (from `api/types.ts`), `server/src/viewTypes.ts`, `server/src/types.spec.ts`, `server/src/logic/{dates,progress,streak}.ts` and their `.spec.ts`

**Interfaces:**
- Produces: identical exports to the originals, except `ErrorKind` gains `'unauthenticated'`. `viewTypes.ts` exports `type VisionItemView = VisionItem & { imageUrl: string | null }` (the web client defines the same type in `http/types.ts`, Task 12).

- [ ] **Step 1: Write failing test** `types.spec.ts`: `server/src/types.ts` equals `app/src/lib/api/types.ts` byte for byte (Review Focus 7).
- [ ] **Step 2:** Copy files and their specs; fix relative imports only. Run `npm test` → PASS (logic is pure; no behaviour change). Commit `feat(server): port error, types and pure logic`.

### Task 5: Timezone-aware helpers

**Files:**
- Create: `server/src/repo/helpers.ts`, `server/src/repo/helpers.spec.ts` (from `app/src/lib/db/repo/helpers.ts` and its spec)

**Interfaces:**
- Produces: `now(): string`, `requiredText`, `optionalText`, `parseDateOrThrow` unchanged; **changed**: `today(tz: string): string` and `localDateOf(timestamp: string, tz: string): string` compute in `tz`; `parseTimezone(raw: string | undefined): string` throws `AppError.validation` for a missing or unknown IANA name.

- [ ] **Step 1: Write failing tests** with a fixed instant (`vi.setSystemTime`): at `2026-01-01T23:30:00Z`, `today('Pacific/Kiritimati')` is `2026-01-02` and `today('Pacific/Pago_Pago')` is `2026-01-01`; `localDateOf` likewise; `parseTimezone(undefined)` and `parseTimezone('Mars/Base')` throw validation (Review Focus 4).
- [ ] **Step 2:** FAIL → implement with `Intl.DateTimeFormat('en-CA', { timeZone, ... })` → PASS. Commit.

### Task 6: Port core repos

**Files:**
- Create (port from `app/src/lib/db/repo/`, with specs): `server/src/repo/{category,settings,goal,subgoal,task}.ts` and specs

**Interfaces:**
- Consumes: `SqlDriver`, helpers, `types.ts`. Signatures stay exactly as in the originals (`list(driver, ...)`, `create(driver, input)`, ...).

- [ ] **Step 1:** Copy repos and specs. Specs replace `createTestDriver()` with the Task 3 helper (`beforeEach` create, `afterEach` release).
- [ ] **Step 2:** Run → FAIL on SQLite-isms. Port each: every `INSERT` ends with `RETURNING id`; `settings` queries drop `WHERE id = 1`; `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`; `COLLATE NOCASE` comparisons → `lower(...)`.
- [ ] **Step 3:** Add isolation specs with two users in separate `withUser` calls: user B gets `notFound` from `get/update/remove` on A's goal, task, subgoal, category ids, and `task.create` with A's `goalId` or `subgoalId` fails with `not_found`/`validation` (Review Focus 1); both users can create a category `Work` (Review Focus 6).
- [ ] **Step 4:** Run → PASS. Commit `feat(server): port category, settings, goal, subgoal, task repos`.

### Task 7: Port streak, completion, idea and vision repos

**Files:**
- Create (port with specs): `server/src/repo/{completion,streak,idea,visionItem}.ts`

**Interfaces:**
- Produces: `streak.list(driver, days, tz)` and `streak.setCompletion(driver, taskId, on, done, days, tz)`; `tz` is also threaded through `task.list/listForSubgoal/listDirectForGoal`, `subgoal.detailForGoal/progressesForGoal` and `goal.list/getDetail`, because those compute "today" too (see the phase 1 plan). Every other signature unchanged. `visionItem` repo stores `imagePath` only; `imageUrl` is attached in Task 10.

- [ ] **Step 1:** Copy repos and specs; thread `tz` through streak (every caller of `today`/`localDateOf` must pass it; none may remain without).
- [ ] **Step 2:** Port SQL as in Task 6 (idea tag names match case-insensitively per user). Add a streak spec where a habit's `created_at` is "yesterday" in the user's zone but "today" in UTC.
- [ ] **Step 3:** Run specs → PASS. Commit.

### Task 8: Auth verifier and app skeleton

**Files:**
- Create: `server/src/auth.ts`, `server/src/auth.spec.ts`, `server/src/app.ts`, `server/src/http.ts`, `server/src/app.spec.ts`

**Interfaces:**
- Produces:
  - `createVerifier(opts: { getKey: JWTVerifyGetKey; issuer: string; audience: string }): (authorization: string | undefined) => Promise<{ userId: string }>` — throws `AppError('unauthenticated', ...)` on anything wrong. Production `getKey` is `createRemoteJWKSet(new URL(jwksUrl))` from `jose`.
  - `createApp(deps: { pool: Pool; verify: Verifier; images: ImageStore }): Express` — a router mounted at `/api`; `GET /api/healthz` (no auth, no DB), `GET /api/readyz` (`SELECT 1`); `express.json()` body parsing; final error middleware maps `AppError` kinds to statuses and body-parser's malformed-JSON error to 400 `validation`.
  - In `http.ts`: middleware `authenticate` (sets `res.locals.userId`; **runs before any DB access**) and `handle<T>(fn: (driver: SqlDriver, ctx: { tz: string; req: Request }) => Promise<T>): RequestHandler` — parses `X-Timezone` lazily (only when `ctx.tz` is read, so routes that don't need it don't require the header), opens `withUser`, sends JSON.

- [ ] **Step 1: Write failing tests.** `auth.spec.ts` with a locally generated key pair: valid token → `{ userId: sub }`; no header, `Basic x`, garbage, expired, wrong issuer, wrong audience, signed by another key → all reject with `unauthenticated`. `app.spec.ts` (supertest): protected route without token → 401 `{kind:'unauthenticated'}` and **zero queries issued** (spy on the pool) (Review Focus 2); `healthz` → 200 without token; bad `X-Timezone` on the streaks route → 400; malformed JSON body → 400.
- [ ] **Step 2:** FAIL → implement → PASS. Commit `feat(server): auth verifier and app skeleton`.

### Task 9: Routes for all data groups

**Files:**
- Create: `server/src/routes/{categories,goals,subgoals,tasks,streaks,ideas,visionItems,settings}.ts`, `server/src/routes/routes.spec.ts`
- Modify: `server/src/app.ts` (mount them)

**Interfaces:** request bodies are the existing `*Input` / `*Update` types as JSON; responses are the existing result types. Routes (all under `/api`):

| Method + path | Maps to |
|---|---|
| `GET /categories`, `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id` | category repo |
| `GET /goals?status=`, `GET /goals/:id`, `POST /goals`, `PUT /goals/:id`, `PUT /goals/:id/status` `{status}`, `DELETE /goals/:id?deleteOrphanedTasks=true\|false` | goal repo |
| `GET /subgoals`, `POST /subgoals`, `PUT /subgoals/:id`, `PUT /subgoals/:id/complete` `{isComplete}`, `DELETE /subgoals/:id` | subgoal repo |
| `GET /tasks`, `POST /tasks`, `PUT /tasks/:id`, `PUT /tasks/:id/status` `{status}`, `DELETE /tasks/:id` | task repo |
| `GET /streaks?days=`, `PUT /tasks/:id/completion` `{done, date?}` | streak repo (needs tz) |
| `GET /ideas?tag=&includePromoted=`, `GET /ideas/:id`, `POST /ideas`, `PUT /ideas/:id`, `DELETE /ideas/:id`, `POST /ideas/:id/promote` `{goalId}`, `GET /idea-tags` | idea repo |
| `GET /vision-items`, `POST /vision-items`, `PUT /vision-items/order` `{orderedIds}`, `PUT /vision-items/:id`, `DELETE /vision-items/:id` | visionItem repo (`/order` registered before `/:id`) |
| `GET /settings`, `PUT /settings/theme` `{theme}`, `PUT /settings/streak-grace-days` `{days}` | settings repo |

A non-numeric `:id` → 400 `validation`.

- [ ] **Step 1: Write failing tests** in `routes.spec.ts` using two signed test tokens (users A and B): for each group a create → list → update → delete round trip as A; as B, `GET/PUT/DELETE` on A's ids return 404 and B's lists never include A's rows (Review Focus 1); a goal deleted with `deleteOrphanedTasks=true` removes its tasks.
- [ ] **Step 2:** FAIL → implement routes with `handle` → PASS. Commit `feat(server): data routes`.

### Task 10: Image store and vision image routes

**Files:**
- Create: `server/src/images.ts`, `server/src/images.spec.ts`, `server/src/routes/visionImages.ts`
- Modify: `server/src/routes/visionItems.ts`, `server/src/app.ts`

**Interfaces:**
- Produces:
  - `interface ImageStore { put(userId: string, bytes: Uint8Array, contentType: string): Promise<string>; remove(path: string): Promise<void>; signedUrl(path: string, expiresInSeconds: number): Promise<string> }`
  - `createSupabaseImageStore(opts: { url: string; serviceKey: string; bucket: string }): ImageStore` (Supabase Storage REST; the service key is used only here). `put` returns `<userId>/<uuid><ext>`. `createMemoryImageStore(): ImageStore` for tests.
  - `POST /api/vision-images` (multipart field `file`, parsed with `multer` memory storage, 5 MB limit) → `{ imagePath }`; allowed types `image/png|jpeg|webp|gif`, else 400.
  - Vision item responses are `VisionItemView` with `imageUrl = signedUrl(imagePath, 3600)`; `PUT`/`DELETE /vision-items/:id` remove the old object after the row change, best-effort, with the same ordering as `updateVisionItem` / `deleteVisionItem` in `app/src/lib/api/index.ts`.
  - `imagePath` on create/update must start with the caller's own `<userId>/`, else 400.

- [ ] **Step 1: Write failing tests** with the memory store: wrong type, empty body, 6 MB body → 400; an item referencing `<otherUserId>/x.png` → 400 and nothing signed; delete removes the object; replacing removes the old one (Review Focus 5).
- [ ] **Step 2-4:** FAIL → implement → PASS. Commit `feat(server): vision image upload and signed urls`.

### Task 11: Entry point, config and container image

**Files:**
- Create: `server/src/main.ts`, `server/src/config.ts`, `server/src/config.spec.ts`, `server/Dockerfile`, `server/.dockerignore`

**Interfaces:**
- Produces: `loadConfig(env: NodeJS.ProcessEnv): Config` (throws one error listing every missing variable among `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`; `PORT` defaults 3000); issuer `${SUPABASE_URL}/auth/v1`, audience `authenticated`, JWKS `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. `main.ts` builds the pool, app and listens, closing the pool on `SIGTERM`. Dockerfile: multi-stage on `node:24-slim`, non-root, runs `node dist/main.js`; the same image runs `node dist/db/migrateCli.js` for the migration Job (migration SQL files copied into `dist`).

- [ ] **Step 1:** Failing test for `loadConfig` (missing vars all listed; default port). **Step 2:** Implement. **Step 3:** `docker build -t mushpoint-api server` succeeds; run it against the compose DB and `curl localhost:3000/api/healthz` → 200. Commit.

---

## Phase 2 - Web client

### Task 12: HTTP api layer and `web` build target

**Files:**
- Create: `app/src/lib/api/http/{client,index,settings,types}.ts`, `app/src/lib/api/http/client.spec.ts`, `app/src/lib/config.ts`, `app/static/config.json` (dev default)
- Modify: `app/svelte.config.js`, `app/package.json` (scripts `build:web`, `dev:web` = `MUSHPOINT_TARGET=web vite dev`)

**Interfaces:**
- Produces: `request<T>(method: string, path: string, body?: unknown): Promise<T>` — prefixes `config.apiUrl`, sends `Authorization: Bearer <getAccessToken()>` and `X-Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone`, parses `{kind,message}` errors into `AppError`, 401 → `onUnauthenticated()`. `http/index.ts` and `http/settings.ts` export **exactly the same names and signatures** as `app/src/lib/api/index.ts` / `settings.ts` (route table in Task 9); `http/types.ts` re-exports `../types` and defines `VisionItemView` (same shape as the server's), which the vision functions return. `config.ts` fetches `/config.json` (`{ apiUrl, supabaseUrl, supabaseAnonKey }`) once at startup.
- Build target: when `MUSHPOINT_TARGET=web`, `$lib/api` resolves to `src/lib/api/http` and `$lib/images` to `src/lib/images.web.ts` (Task 14); otherwise nothing changes. If SvelteKit's alias precedence makes this unreliable, use a Vite plugin `resolveId` hook instead.

- [ ] **Step 1: Write failing tests** (`client.spec.ts`, mocked `fetch`): headers present; error JSON becomes `AppError` with the same `kind`; 401 triggers the callback.
- [ ] **Step 2:** FAIL → implement client and one function per route → PASS. **Step 3:** `MUSHPOINT_TARGET=web npm run check` passes (type-compatibility of every importing component proves the surface matches); `npm run check` (Tauri target) still passes. Commit `feat(web): http api layer and web build target`.

### Task 13: Sign up, log in, reset, route guard

**Files:**
- Create: `app/src/lib/auth/supabase.ts`, `app/src/lib/auth/session.svelte.ts`, `app/src/routes/login/+page.svelte`, `app/src/routes/auth/callback/+page.svelte` (email-confirmation / reset landing)
- Modify: `app/src/routes/+layout.ts` and `+layout.svelte` (web target only: if no session, redirect to `/login`; Tauri target unchanged), `app/package.json` (`@supabase/supabase-js`)

**Interfaces:**
- Produces: `getAccessToken(): Promise<string | null>`, `signUp(email, password)`, `signIn(email, password)`, `signOut()`, `requestPasswordReset(email)`, reactive `session`; Task 12's `onUnauthenticated` is wired to `signOut()` + redirect.

- [ ] **Step 1: Write failing tests** for the session module with supabase-js mocked: `getAccessToken` returns null when signed out; `signOut` clears it.
- [ ] **Step 2:** Implement. The login page follows existing page and `mushpoint-design` component patterns (use the `impeccable` skill for the form and its error/empty states) and shows a "check your email to confirm" state after sign-up.
- [ ] **Step 3:** Manual check with a real Supabase project (Confirm email ON, Storage bucket `vision` private): sign up, confirm via email, log in, reload (session persists), log out. Commit.

### Task 14: Image upload for web and Tauri-only leftovers

**Files:**
- Create: `app/src/lib/images.web.ts`
- Modify: `app/src/lib/components/VisionItemDrawer.svelte`, `VisionImage.svelte`, `app/src/routes/goals/[id]/+page.svelte` only where they call something `images.web.ts` cannot match

**Interfaces:**
- Produces: `images.web.ts` with the same exports as `app/src/lib/images.ts`; the picker is an `<input type="file">` that POSTs to `/api/vision-images`; displaying an item uses `item.imageUrl`.

- [ ] **Step 1:** Failing test for the picker's upload call (mocked `request`). **Step 2:** Implement. **Step 3:** `MUSHPOINT_TARGET=web npm run check && npm run build:web` pass; no `@tauri-apps` import is reachable from the web bundle (grep `build/`). Commit.

### Task 15: End-to-end smoke test against the local stack

**Files:**
- Create: `app/e2e/web.e2e.ts`; modify `app/playwright.config.ts` only to add a `web` project

- [ ] **Step 1:** Playwright flow with two accounts (Supabase test project, or a local stub JWKS server if preferred; note the choice in the commit message): A signs up and logs in, creates a goal and a task, ticks the task; B logs in and sees none of it.
- [ ] **Step 2:** Run against `docker compose` Postgres + the API container + `vite preview` of the web build. Expect PASS. Commit.

---

## Phase 3 - Kubernetes (local)

### Task 16: Web container, manifests, local cluster, runbook

**Files:**
- Create: `app/Dockerfile.web` (build with `MUSHPOINT_TARGET=web`, serve with nginx, SPA fallback), `deploy/k8s/{namespace,configmap-web,configmap-api,secret.example,migrate-job,api-deployment,api-service,web-deployment,web-service,ingress}.yaml`, `deploy/kind-config.yaml`, `docs/k8s-runbook.md`

**Interfaces / pinned decisions:**
- Namespace `mushpoint`. API Deployment: 2 replicas, image `mushpoint-api`, env from ConfigMap + Secret, liveness `GET /api/healthz`, readiness `GET /api/readyz`, resource requests/limits set. Web Deployment: nginx, `/config.json` mounted from a ConfigMap (one image serves any environment). Migration runs as a `Job` using the API image with command `node dist/db/migrateCli.js`, `MIGRATE_DATABASE_URL` and `MUSHPOINT_APP_PASSWORD` from the Secret.
- Ingress (ingress-nginx): `/api` → API service, `/` → web service, `limit-rps` annotation. kind config maps host port 8080 → ingress.
- Runbook explains each manifest in a paragraph and gives the exact commands to: create the cluster, load images (`kind load docker-image`), create the Secret from a local file, apply manifests, watch rollout, view logs, scale to 3, break a probe and observe, roll out a new image, roll back (`kubectl rollout undo`), tear down.

- [ ] **Step 1:** `kubectl apply --dry-run=client -f deploy/k8s` passes for every file.
- [ ] **Step 2:** Build both images, create the kind cluster, install ingress-nginx, apply Secret then manifests; `kubectl -n mushpoint rollout status deploy/api deploy/web` completes; Job `migrate` Completed.
- [ ] **Step 3:** Open `http://localhost:8080`, sign up, create a goal and a task, upload a vision image, reload. `kubectl delete pod` one API pod mid-use: the page keeps working. Record results in the runbook.
- [ ] **Step 4:** Commit `feat(deploy): kubernetes manifests and runbook`.

---

## Self-review notes

- Spec coverage: signup/open auth (Task 13), per-user data + RLS (2, 3, 6, 9), images (10, 14), timezone (5, 7), API under bearer token (8), Express per the owner's preference (1-11), kind-first deployment + runbook (16), email verification via Supabase setting (13 manual check), rate limiting at ingress (16). Phase 4 intentionally excluded and stated at top.
- Names defined once and reused: `SqlDriver`, `withUser`, `bootstrapUser`, `createTestDriver`, `createVerifier`, `createApp`, `handle`, `ImageStore`, `VisionItemView`, `request`, `AppError`.
