# Mushpoint

Mushpoint is a goal tracker. Goals break down into subgoals and tasks, recurring
tasks build habit streaks, ideas wait in an inbox until they are ready to become
goals, and a vision board holds the images and quotes that keep you going.

It is a hosted, multi-user web app:

- **`app/`**: a SvelteKit 2 + Svelte 5 single-page app (static adapter, no SSR)
  styled with Tailwind v4.
- **`server/`**: an Express 5 API on Node 24 backed by Postgres 16, with
  row-level security (RLS) isolating every user's data.
- **Supabase** provides two things only: sign-in (access tokens the API
  verifies against Supabase's JWKS) and private image storage for the vision
  board.

Mushpoint started as a local-first desktop app (Tauri + SQLite). That version
is retired; its last state is tagged `desktop-sqlite-final`.

## Contents

- [Features](#features)
- [Repo layout](#repo-layout)
- [Architecture](#architecture)
- [Auth flow](#auth-flow)
- [Request lifecycle](#request-lifecycle)
- [Data model](#data-model)
- [API overview](#api-overview)
- [Local development](#local-development)
- [Testing](#testing)
- [Deployment and infrastructure](#deployment-and-infrastructure)
- [Configuration reference](#configuration-reference)
- [Further reading](#further-reading)

## Features

- **Accounts**: email and password sign-up with email confirmation, sign-in,
  password reset and email change, all through Supabase using the PKCE flow.
  New users pick a unique username on `/welcome`. The login and sign-up
  forms have a show/hide password toggle, and Settings offers permanent
  account deletion.
- **Dashboard** (`/`): today's tasks, upcoming items, a goals panel, habit
  streaks, a vision board preview and quick add.
- **Goals** (`/goals`, `/goals/:id`): short, mid or long term goals with a
  category, due date, motivation text, an optional repository URL and a status
  (`active`, `completed`, `archived`). The detail page has List, Kanban and
  Timeline (Gantt) views.
- **Subgoals**: one level under a goal, comparable to OKR key results.
- **Tasks** (`/tasks`): `todo`, `in_progress` and `done`, optionally linked to
  a goal or subgoal. The task manager has a Kanban board and a calendar view.
- **Progress**: calculated, never set by hand. A goal averages its direct
  children (subgoals and directly linked tasks weigh the same); a subgoal
  averages its tasks; only `done` tasks count.
- **Habits and streaks**: a task can recur `daily`, `weekdays` or `weekly`.
  Completions per day feed a streak counter and heatmap, with a configurable
  grace period of 0 to 7 days. "Today" is always the user's local date.
- **Categories**: each new user gets five defaults (Work, Gym, School, Side
  Projects, Social) and can add their own.
- **Ideas** (`/ideas`): a quick-capture inbox with tags. An idea can be
  promoted into a new goal in one transaction.
- **Vision board** (`/vision-board`): image and quote cards in a user-defined
  order. Images (PNG, JPEG, WebP, GIF, up to 5 MB) go through the API into a
  private bucket and come back as signed URLs that expire after one hour.
- **Themes**: `nocturne` (default) and `coquette`, from the shared
  [`mushpoint-design`](https://github.com/Vu1nea/mushpoint-design) package,
  saved per user.

## Repo layout

```text
app/                 SvelteKit web client (see app/README.md)
  src/lib/api/       the only code that talks to the API: one HTTP call per function
  src/lib/auth/      Supabase session, PKCE callback, token access, public routes
  src/routes/        one folder per screen
  static/            config.json (runtime config), assets
  e2e/               Playwright end-to-end suite
server/              Express API (see server/README.md)
  src/app.ts         builds the Express app and mounts every router under /api
  src/main.ts        entry point: config, pool, JWKS verifier, image store, listen
  src/http.ts        authenticate middleware, per-request transaction wrapper, error handler
  src/auth.ts        Supabase JWT verifier (ES256/RS256 only)
  src/authAdmin.ts   Supabase Auth admin client (account deletion)
  src/images.ts      Supabase Storage client (upload, remove, signed URLs)
  src/db/            pool, migration runner, withUser scope, migrations/*.sql
  src/repo/          SQL per entity (goal, task, idea, ...)
  src/routes/        Express routers per entity
  src/logic/         pure progress, streak and date logic
  docker-compose.yml local Postgres 16
  Dockerfile         API image (also runs migrations)
docs/                specs, plans, auth deep dive, bug log
  auth.md            how sign-in, tokens and RLS fit together
  superpowers/specs/ design specs
  superpowers/plans/ implementation plans, including the hosting roadmap
TODO.md              near-term work
```

## Architecture

The browser holds the Supabase session and calls the API with a bearer token.
The API verifies the token, then runs each request as one Postgres transaction
scoped to that user. The API is the only thing that touches the database and
the storage bucket; the browser never talks to either directly.

```mermaid
flowchart LR
    subgraph Browser
        SPA["SvelteKit SPA<br/>(app/)"]
    end

    subgraph Supabase
        AUTH["Supabase Auth<br/>(sign-in, JWKS)"]
        STORAGE["Supabase Storage<br/>(private bucket: vision)"]
    end

    subgraph Backend
        API["Mushpoint API<br/>Express 5, Node 24<br/>(server/)"]
        PG[("Postgres 16<br/>RLS per user")]
    end

    SPA -- "sign-up, sign-in, refresh (PKCE)" --> AUTH
    SPA -- "/api/* with Bearer token + X-Timezone" --> API
    API -- "fetch signing keys (cached)" --> AUTH
    API -- "admin: delete user (service key)" --> AUTH
    API -- "SQL as mushpoint_app (NOBYPASSRLS)" --> PG
    API -- "upload, remove, sign URLs (service key)" --> STORAGE
    SPA -. "load images via signed URL" .-> STORAGE
```

Key design decisions:

- **RLS is the isolation boundary.** Every table has a `user_id` column that
  defaults to `current_setting('app.user_id')`, and a policy that limits
  `mushpoint_app` to rows with that id. Repository SQL has no per-query user
  filter. Another user's id answers 404, never data.
- **The API role cannot bypass RLS.** The API connects as `mushpoint_app`
  (`NOBYPASSRLS`). Migrations run separately as the database owner.
- **Supabase's Data API cannot read the tables.** Policies apply only to
  `mushpoint_app`, and the migrations revoke table access from Supabase's
  `anon` and `authenticated` roles.
- **One origin.** The client calls `/api` on its own origin (the Vite dev and
  preview servers proxy it to port 3000), so the API needs no CORS.
- **Time zones come from the client.** The server never uses its own clock for
  "today"; it reads the user's IANA zone from `X-Timezone`.

## Auth flow

Sign-in happens entirely between the browser and Supabase, using email and
password with PKCE. Every email link (sign-up confirmation, password reset,
email change) lands on `/auth/callback`, which exchanges the code for a
session. The API has no auth endpoints; it only verifies tokens.

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant B as Browser (SvelteKit SPA)
    participant S as Supabase Auth
    participant A as Mushpoint API
    participant D as Postgres (RLS)

    U->>B: Sign in with email and password
    B->>S: signInWithPassword
    S-->>B: Access token and refresh token (localStorage)

    U->>B: Open a page
    B->>B: getAccessToken()
    alt Token expired
        B->>S: Refresh with refresh token
        S-->>B: New access token
    end
    B->>A: GET /api/goals (Authorization Bearer, X-Timezone)
    A->>S: Fetch JWKS (cached)
    A->>A: Verify signature (ES256/RS256), issuer, audience, sub is a UUID
    A->>D: SELECT from deleted_users
    alt Bad token or deleted account
        A-->>B: 401 unauthenticated
        B->>B: Sign out, or finish a pending deletion
    else Valid
        A->>D: BEGIN, set app.user_id, bootstrap user, query, COMMIT
        D-->>A: Only this user's rows
        A-->>B: 200 JSON
    end
```

What the API checks on every token:

- Algorithm is `ES256` or `RS256`. A Supabase project still on the legacy
  HS256 shared secret fails closed: every request answers 401.
- Issuer is `<SUPABASE_URL>/auth/v1` and audience is `authenticated`.
- `sub` is a UUID; it becomes the user id.
- The user is not in `deleted_users`. Access tokens stay valid until they
  expire, so this tombstone check is what locks out a deleted account.

The client side (route guard, PKCE callback, 401 handling) is described in
[`app/README.md`](app/README.md#how-sign-in-reaches-the-api), and each step in
detail in [`docs/auth.md`](docs/auth.md).

### Account deletion

`DELETE /api/account` answers 204 after it, in order:

1. writes a tombstone to `deleted_users`,
2. removes every image under `<userId>/` in the bucket,
3. deletes every row the user owns,
4. deletes the Supabase login through the Auth admin API.

Each step is idempotent. If one fails partway (503 when Storage or Auth is
down), the account is already locked out by the tombstone, and the client
retries the deletion on its next load. This route is the only one that skips
the tombstone check, so the retry can get through.

## Request lifecycle

```mermaid
flowchart TD
    REQ(["HTTP request"]) --> MOUNT{"Path under /api?"}
    MOUNT -- no --> NF404["404 not_found"]
    MOUNT -- yes --> HEALTH{"/healthz or /readyz?"}
    HEALTH -- yes --> HOK["200, no auth<br/>(readyz runs SELECT 1 as the app role)"]
    HEALTH -- no --> JSON["express.json (1 MB limit)"]
    JSON --> DEL{"DELETE /account?"}
    DEL -- yes --> AUTHD["authenticate (no tombstone check)"] --> DELACC["deleteAccount"]
    DEL -- no --> AUTH["authenticate: verify JWT,<br/>reject if in deleted_users"]
    AUTH --> ROUTER["Entity router"]
    ROUTER --> HANDLE["handle(): withUser transaction"]
    HANDLE --> TX["BEGIN<br/>set_config('app.user_id')<br/>bootstrapUser (first request only)<br/>repo SQL<br/>COMMIT"]
    TX --> AFTER["afterCommit (e.g. remove replaced image)<br/>present (e.g. attach signed URLs)"]
    AFTER --> RES["JSON response or 204"]
    AUTH -. throws .-> ERR["errorHandler"]
    TX -. "throws (ROLLBACK)" .-> ERR
    ERR --> ERES["{ kind, message }<br/>400 / 401 / 404 / 500 / 503"]
```

Details worth knowing:

- **One transaction per request.** `withUser` opens a transaction, sets
  `app.user_id` with `set_config(..., true)` (transaction-local), runs the
  route and commits, or rolls back on any error.
- **First-request bootstrap.** If the user has no `settings` row yet, the same
  transaction creates it plus the five default categories. A transaction-level
  advisory lock keyed on the user id keeps two parallel first requests from
  creating duplicates.
- **Slow work happens after commit.** Signing image URLs and removing replaced
  images run after `COMMIT`, so they never hold a transaction open. An
  `afterCommit` failure is logged, not sent to the client.
- **`X-Timezone` is read lazily.** The client always sends it. Routes that
  work out "today" (`GET /goals`, `GET /goals/:id`, `GET /tasks`,
  `GET /streaks`, `PUT /tasks/:id/completion`) answer 400 if it is missing or
  not a valid IANA zone.
- **Errors are always `{ "kind", "message" }`.** 400 `validation` (including
  malformed JSON, oversized bodies, bad uploads, unique violations), 401
  `unauthenticated`, 404 `not_found`, 500 `internal`/`database` (message is
  always `internal error`), 503 `unavailable`.

## Data model

Schema lives in [`server/src/db/migrations/`](server/src/db/migrations), applied
in filename order and recorded in `schema_migrations`. There is no users table:
`user_id` is the Supabase user id, with no foreign key to Supabase's
`auth.users`. The dashed lines below are that logical link, enforced by RLS
rather than by a constraint. Timestamps and dates are stored as `text` (ISO
strings formatted by the repos), and boolean-like columns as `integer`.

```mermaid
erDiagram
    SUPABASE_AUTH_USER ||..o| PROFILES : "user_id"
    SUPABASE_AUTH_USER ||..o| SETTINGS : "user_id"
    SUPABASE_AUTH_USER ||..o{ CATEGORIES : "user_id"
    SUPABASE_AUTH_USER ||..o{ GOALS : "user_id"
    SUPABASE_AUTH_USER ||..o{ TASKS : "user_id"
    SUPABASE_AUTH_USER ||..o{ IDEAS : "user_id"
    SUPABASE_AUTH_USER ||..o{ VISION_ITEMS : "user_id"
    SUPABASE_AUTH_USER ||..o| DELETED_USERS : "tombstone"

    CATEGORIES |o--o{ GOALS : "category_id (SET NULL)"
    GOALS ||--o{ SUBGOALS : "goal_id (CASCADE)"
    GOALS |o--o{ TASKS : "goal_id (SET NULL)"
    SUBGOALS |o--o{ TASKS : "subgoal_id (SET NULL)"
    TASKS ||--o{ TASK_COMPLETIONS : "task_id (CASCADE)"
    GOALS |o--o{ IDEAS : "promoted_goal_id (SET NULL)"
    IDEAS ||--o{ IDEA_TAG_LINKS : "idea_id (CASCADE)"
    IDEA_TAGS ||--o{ IDEA_TAG_LINKS : "tag_id (CASCADE)"

    SUPABASE_AUTH_USER {
        uuid id PK "external, owned by Supabase"
    }
    PROFILES {
        uuid user_id PK
        text username "unique, case-insensitive"
        text updated_at
    }
    SETTINGS {
        uuid user_id PK
        text active_theme "default nocturne"
        integer streak_grace_days "0 to 7, default 2"
        text updated_at
    }
    CATEGORIES {
        bigint id PK
        uuid user_id
        text name "unique per user"
        text color_token
        integer is_default
        text created_at
    }
    GOALS {
        bigint id PK
        uuid user_id
        bigint category_id FK
        text title
        text description
        text timeframe "short, mid, long"
        text status "active, completed, archived"
        text due_date
        text motivation_text
        text motivation_image_path
        text repo_url
        text created_at
        text updated_at
    }
    SUBGOALS {
        bigint id PK
        uuid user_id
        bigint goal_id FK
        text title
        text due_date
        integer is_complete
        integer position
        text created_at
        text updated_at
    }
    TASKS {
        bigint id PK
        uuid user_id
        text title
        text status "todo, in_progress, done"
        text due_date
        bigint goal_id FK
        bigint subgoal_id FK
        text recurrence "daily, weekdays, weekly, or null"
        text created_at
        text updated_at
    }
    TASK_COMPLETIONS {
        bigint id PK
        uuid user_id
        bigint task_id FK
        text completed_on "unique per task"
        text created_at
    }
    IDEAS {
        bigint id PK
        uuid user_id
        text title
        text note
        bigint promoted_goal_id FK
        text created_at
        text updated_at
    }
    IDEA_TAGS {
        bigint id PK
        uuid user_id
        text name "unique per user, case-insensitive"
        text created_at
    }
    IDEA_TAG_LINKS {
        uuid user_id
        bigint idea_id PK, FK
        bigint tag_id PK, FK
    }
    VISION_ITEMS {
        bigint id PK
        uuid user_id
        text image_path "userId/uuid.ext in the bucket"
        text quote_text
        integer position
        text created_at
        text updated_at
    }
    DELETED_USERS {
        uuid user_id PK
        timestamptz deleted_at
    }
```

Migrations:

| File | What it does |
|---|---|
| `0001_init.sql` | Creates the `mushpoint_app` role, every core table, indexes, and the `own_rows` RLS policy on each table (`ENABLE` and `FORCE`). |
| `0002_policies_app_role_only.sql` | Re-creates the policies for `mushpoint_app` only, and revokes table access from Supabase's `anon` and `authenticated` roles if they exist. |
| `0003_profiles.sql` | Adds `profiles` (one username per user, unique case-insensitively) with RLS. |
| `0004_deleted_users.sql` | Adds the `deleted_users` tombstone table. It has no RLS, since the API checks any user id against it; `mushpoint_app` can only `SELECT` and `INSERT`. |

Migrations only add. Apply them before deploying a server version that needs
them; the previous server version keeps working on the migrated database.

## API overview

Everything is under `/api`. Request and response bodies are JSON, except image
upload (multipart). Every route except `healthz` and `readyz` needs
`Authorization: Bearer <Supabase access token>`.

| Group | Routes |
|---|---|
| Health | `GET /healthz`, `GET /readyz` |
| Categories | `GET /categories`, `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id` |
| Goals | `GET /goals?status=`, `GET /goals/:id`, `POST /goals`, `PUT /goals/:id`, `PUT /goals/:id/status`, `DELETE /goals/:id?deleteOrphanedTasks=` |
| Subgoals | `GET /subgoals`, `POST /subgoals`, `PUT /subgoals/:id`, `PUT /subgoals/:id/complete`, `DELETE /subgoals/:id` |
| Tasks | `GET /tasks`, `POST /tasks`, `PUT /tasks/:id`, `PUT /tasks/:id/status`, `DELETE /tasks/:id` |
| Streaks | `GET /streaks?days=`, `PUT /tasks/:id/completion` |
| Ideas | `GET /ideas?tag=&includePromoted=`, `GET /ideas/:id`, `POST /ideas`, `PUT /ideas/:id`, `DELETE /ideas/:id`, `POST /ideas/:id/promote`, `GET /idea-tags` |
| Vision board | `GET /vision-items`, `POST /vision-items`, `PUT /vision-items/order`, `PUT /vision-items/:id`, `DELETE /vision-items/:id`, `POST /vision-images` (multipart field `file`) |
| Settings | `GET /settings`, `PUT /settings/theme`, `PUT /settings/streak-grace-days` |
| Profile | `GET /profile`, `PUT /profile/username` |
| Account | `DELETE /account` |

The request and response types are defined once in
[`server/src/types.ts`](server/src/types.ts) and mirrored in
[`app/src/lib/api/types.ts`](app/src/lib/api/types.ts). A server test keeps the
two files byte-identical.

## Local development

### Prerequisites

- Node 24 or newer
- Docker (for the local Postgres)
- A Supabase project with:
  - asymmetric JWT signing keys (JWKS) enabled
  - **Confirm email** and **Secure email change** turned on
  - redirect URLs `http://localhost:5173/auth/callback` (dev) and
    `http://localhost:4173/auth/callback` (preview and e2e)
  - a **private** Storage bucket named `vision` (the
    [server README](server/README.md#supabase-setup) has a `curl` command that
    creates it)

### 1. Start the database and the API

```sh
cd server
cp .env.example .env        # then fill in SUPABASE_URL and SUPABASE_SERVICE_KEY
npm install
npm run db:up               # Postgres 16 on localhost:54329, waits until healthy
npm run migrate             # applies migrations as the owner, sets the mushpoint_app password
npm run dev                 # API on http://localhost:3000, restarts on change
```

Check it with `curl localhost:3000/api/healthz` (`{"status":"ok"}`) and
`curl localhost:3000/api/readyz` (`{"status":"ready"}`).

### 2. Start the web client

```sh
cd app
cp static/config.example.json static/config.json   # fill in supabaseUrl and supabaseAnonKey
npm install
npm run dev                 # http://localhost:5173, proxies /api to port 3000
```

Leave `apiUrl` as `/api`. `config.json` is safe to ship to the browser; never
put the Supabase service key in it. Client details are in
[`app/README.md`](app/README.md).

### Useful scripts

| Where | Command | What it does |
|---|---|---|
| `server/` | `npm run db:up` / `npm run db:down` | Start Postgres / remove it and its data |
| `server/` | `npm run migrate` | Apply migrations using `MIGRATE_DATABASE_URL` |
| `server/` | `npm run dev` | Run `src/main.ts` with tsx in watch mode, reading `.env` |
| `server/` | `npm run build` | Bundle `dist/main.js` and `dist/db/migrateCli.js` with esbuild, copy migrations |
| `server/` | `npm start` | Run the built `dist/main.js` |
| `server/` | `npm run check` | Type-check with `tsc --noEmit` |
| `app/` | `npm run dev` | Vite dev server on port 5173 |
| `app/` | `npm run build` / `npm run preview` | Static build into `build/` / serve it on port 4173 |
| `app/` | `npm run check` | `svelte-check` type check |
| `app/` | `npm run lint` / `npm run format` | Prettier check / write |

## Testing

### Server

```sh
cd server
npm run db:up    # the suite needs the compose database
npm test         # Vitest; global setup applies migrations first
npm run check
```

The server suite runs against real Postgres. It covers the migration runner,
RLS policies, the per-user scope and first-request bootstrap (including the
parallel-request race), every repository, the pure progress, streak and date
logic, the JWT verifier (expired, wrong issuer or audience, foreign key,
HS256), config loading, the image store, and every route with two users to
prove one can never read or change the other's data. Tests sign their own
tokens and use an in-memory image store, so they need no Supabase project.

### Client unit tests

```sh
cd app
npm run test:unit   # Vitest in watch mode
npm test            # Vitest, run once
npm run check       # svelte-check
```

Unit tests cover client logic (calendar, Kanban, Gantt, dashboard, dates,
optimistic updates, config, images) and the API client with HTTP mocked.

### End-to-end tests

The Playwright suite drives the built app against the real API and a real
Supabase project. It creates two throwaway users and deletes them afterwards,
even when a test fails.

```sh
cd server && npm run db:up && npm run migrate
cd ../app
cp .env.e2e.example .env.e2e   # fill in E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_KEY, E2E_PASSWORD
npm run test:e2e
```

Playwright starts the API with `npm --prefix ../server run dev` (or reuses one
on port 3000), then builds the app and previews it on port 4173. `static/config.json`,
`server/.env` and `.env.e2e` must all point at the same Supabase project. Email
flows (confirmation, reset, email change) are not covered by e2e; the manual
checklist is in [`app/README.md`](app/README.md#check-email-flows-by-hand).

## Deployment and infrastructure

### Today

Nothing is deployed to a hosted environment yet. Local development runs:

- **Postgres** in Docker via [`server/docker-compose.yml`](server/docker-compose.yml)
  (`postgres:16`, host port 54329). This is the only service in the compose
  file.
- **The API** on the host with `npm run dev`, or as a container built from
  [`server/Dockerfile`](server/Dockerfile).
- **The web client** on the host with the Vite dev server (5173) or
  `vite preview` (4173), both proxying `/api` to port 3000.
- **Supabase** (hosted) for auth and image storage.

The API image is a multi-stage `node:24-slim` build that runs as the non-root
`node` user and exposes port 3000. The same image runs migrations:

```sh
docker build -t mushpoint-api server
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://mushpoint_app:mushpoint_app@host.docker.internal:54329/postgres \
  -e SUPABASE_URL=https://<project>.supabase.co -e SUPABASE_SERVICE_KEY=<service key> \
  mushpoint-api
# migrations: same image, command `node dist/db/migrateCli.js`,
# with MIGRATE_DATABASE_URL and MUSHPOINT_APP_PASSWORD set
```

The client builds to static files (`app/build/`, SPA fallback `index.html`)
and needs only a static file server plus a `/api` route to the API on the same
origin.

### Planned: local Kubernetes (phase 3)

> **Planned, not built.** There is no `deploy/` directory yet. This section
> follows the roadmap in
> [`docs/superpowers/plans/2026-11-06-hosted-server.md`](docs/superpowers/plans/2026-11-06-hosted-server.md)
> (Task 16) and the
> [hosted-server spec](docs/superpowers/specs/2026-11-06-hosted-server-design.md);
> details may change when the phase gets its detailed plan.

- A **kind** cluster with **ingress-nginx**; host port 8080 maps to the ingress.
- Namespace `mushpoint`.
- **API Deployment**: 2 replicas of `mushpoint-api`, env from a ConfigMap and a
  Secret, liveness probe `GET /api/healthz`, readiness probe `GET /api/readyz`,
  resource requests and limits.
- **Web Deployment**: nginx serving the static build with SPA fallback;
  `/config.json` mounted from a ConfigMap so one image serves any environment.
- **Migrate Job**: the API image running `node dist/db/migrateCli.js` with
  `MIGRATE_DATABASE_URL` and `MUSHPOINT_APP_PASSWORD` from the Secret.
- **Ingress**: `/api` to the API service, `/` to the web service, one origin
  (no CORS), request-rate limiting through an ingress annotation. The API
  process has no rate limiter of its own.
- **Database**: external (Supabase Postgres); no database runs in the cluster.
- Secrets are never committed; manifests ship `*.example.yaml` only. A runbook
  (`docs/k8s-runbook.md`) will cover create, load images, apply, scale, roll
  out, roll back and tear down.

```mermaid
flowchart TB
    subgraph TODAY["Today: local development"]
        direction LR
        DEV_B["Browser"] --> VITE["Vite dev :5173<br/>or preview :4173"]
        VITE -- "proxy /api" --> DEV_API["API on host :3000<br/>(npm run dev)"]
        DEV_API --> COMPOSE[("docker compose<br/>postgres:16 :54329")]
        DEV_B --> SB1["Supabase Auth + Storage"]
        DEV_API --> SB1
    end

    subgraph PLANNED["Planned: kind cluster (phase 3)"]
        direction LR
        K_B["Browser<br/>localhost:8080"] --> ING["ingress-nginx<br/>(rate limit)"]
        subgraph NS["namespace: mushpoint"]
            ING -- "/" --> WEB["web Deployment<br/>nginx + config.json ConfigMap"]
            ING -- "/api" --> APISVC["api Service"]
            APISVC --> API1["api pod 1"]
            APISVC --> API2["api pod 2"]
            JOB["migrate Job<br/>node dist/db/migrateCli.js"]
            CFG["ConfigMap + Secret"]
        end
        API1 --> SBPG[("Supabase Postgres")]
        API2 --> SBPG
        JOB --> SBPG
        API1 --> SB2["Supabase Auth + Storage"]
        K_B --> SB2
    end
```

### Future: cloud (phase 4)

Moving the same manifests to a cloud cluster with a domain and HTTPS, and
updating the Supabase redirect URLs for the real origin, is deliberately out of
scope until the local cluster works. No provider has been chosen.

## Configuration reference

### API (`server/.env`)

| Variable | Used by | Required | Meaning |
|---|---|---|---|
| `DATABASE_URL` | API | yes | Connection string for `mushpoint_app` (`NOBYPASSRLS`). Never the owner or a Supabase service role. |
| `SUPABASE_URL` | API | yes | Project URL, such as `https://abcd.supabase.co`. Issuer and JWKS URL are derived from it. |
| `SUPABASE_SERVICE_KEY` | API | yes | Used only for Storage and the Auth admin API (account deletion). |
| `PORT` | API | no (3000) | Listen port. |
| `IMAGE_BUCKET` | API | no (`vision`) | Storage bucket for vision board images. |
| `MIGRATE_DATABASE_URL` | migrate | yes | Owner connection string, used only by migrations. |
| `MUSHPOINT_APP_PASSWORD` | migrate | yes | Password the migration sets on `mushpoint_app`. |

The API fails fast at startup, naming every missing required variable.

### Web client (`app/static/config.json`)

Loaded once at startup, so the same build works in any environment.

| Key | Meaning |
|---|---|
| `apiUrl` | API base path. Keep it `/api` (same origin). |
| `supabaseUrl` | Supabase project URL. |
| `supabaseAnonKey` | Supabase anon (public) key. Safe to ship to the browser. |

### End-to-end tests (`app/.env.e2e`)

| Variable | Meaning |
|---|---|
| `E2E_SUPABASE_URL` | Same Supabase project as the client and server. |
| `E2E_SUPABASE_SERVICE_KEY` | Service key used to create and delete the throwaway users. Never commit it. |
| `E2E_PASSWORD` | Password for both throwaway users (8+ characters). |

## Further reading

- [`app/README.md`](app/README.md): running the client, route guard, project
  layout, behavior notes
- [`server/README.md`](server/README.md): commands, Supabase setup, container,
  API conventions, account deletion
- [`docs/auth.md`](docs/auth.md): sign-in, tokens and RLS step by step
- [`docs/superpowers/specs/`](docs/superpowers/specs): design specs, including
  the [hosted server](docs/superpowers/specs/2026-11-06-hosted-server-design.md)
  and [web client](docs/superpowers/specs/2026-11-08-phase-2-web-client-design.md)
- [`docs/superpowers/plans/`](docs/superpowers/plans): implementation plans
- [`docs/BUG-LOG.md`](docs/BUG-LOG.md) and [`TODO.md`](TODO.md): known issues
  and near-term work
