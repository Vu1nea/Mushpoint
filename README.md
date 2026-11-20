# Mushpoint

Mushpoint is a goal tracker. Goals break down into subgoals and tasks, recurring tasks build habit streaks, ideas wait in an inbox until they're ready to become goals, and a vision board holds the images and quotes that keep you going.

Mushpoint is a hosted, multi-user web app with 3 parts:

- **`app/`**: a SvelteKit 2 and Svelte 5 single-page app (SPA) styled with Tailwind v4. It uses the static adapter, with no server-side rendering (SSR).
- **`server/`**: an Express 5 API on Node 24 backed by Postgres 16. Row-level security (RLS) isolates every user's data.
- **Supabase**: provides 2 things only. It handles sign-in, issuing access tokens (JSON Web Tokens, or JWTs) that the API verifies against Supabase's JSON Web Key Set (JWKS), and it stores vision board images in a private bucket.

Mushpoint started as a local-first desktop app (Tauri and SQLite). That version is retired, and the tag `desktop-sqlite-final` marks its last state.

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

Mushpoint covers accounts, goal planning, habits, an idea inbox and a vision board:

- **Accounts**: email and password sign-up with email confirmation, sign-in, password reset and email change, all through Supabase using the Proof Key for Code Exchange (PKCE) flow. New users pick a unique username on `/welcome` and can upload a profile picture in **Settings**, which replaces their initial. The login and sign-up forms have a show/hide password toggle, and **Settings** offers permanent account deletion.
- **Dashboard** (`/`): today's tasks, upcoming items, a goals panel, habit streaks, a vision board preview and quick add. Quick add creates ideas and tasks; to create a goal, add an idea and promote it.
- **Goals** (`/goals`, `/goals/:id`): short, mid or long term goals with a category, due date, motivation text, an optional repository URL and a status (`active`, `completed`, `archived`). The detail page has List, Kanban and Timeline (Gantt) views.
- **Subgoals**: one level under a goal, comparable to key results in Objectives and Key Results (OKR).
- **Tasks** (`/tasks`): `todo`, `in_progress` or `done`, optionally linked to a goal or subgoal. The task manager has a Kanban board and a calendar view.
- **Progress**: Mushpoint calculates progress; you never set it by hand. A goal averages its direct children, where subgoals and directly linked tasks weigh the same. A subgoal averages its tasks. Only `done` tasks count.
- **Habits and streaks**: a task can recur `daily`, `weekdays` or `weekly`. Completions per day feed a streak counter and heatmap, with a grace period you can set from 0 to 7 days. “Today” is always your local date.
- **Categories**: each new user gets 5 defaults (Work, Gym, School, Side Projects, Social) and can add their own.
- **Ideas** (`/ideas`): a quick-capture inbox with tags. Promoting an idea creates a new goal in one transaction.
- **Vision board** (`/vision-board`): image and quote cards in an order you choose. Images (PNG, JPEG, WebP, GIF, up to 5&nbsp;MB) go through the API into a private bucket and come back as signed URLs that expire after 1 hour.
- **Themes**: `nocturne` (default) and `coquette`, from the shared [`mushpoint-design`](https://github.com/Vu1nea/mushpoint-design) package, saved per user.

## Repo layout

The repo holds 2 packages, `app/` and `server/`, plus design docs:

```text
app/                 SvelteKit web client (see app/README.md)
  src/lib/api/       the only code that calls the API, one function per call
  src/lib/auth/      Supabase session, PKCE callback, token access, public routes
  src/routes/        one folder per screen
  static/            config.json (runtime config), assets
  e2e/               Playwright end-to-end suite
server/              Express API (see server/README.md)
  src/app.ts         builds the Express app, mounts every router under /api
  src/main.ts        entry point: config, pool, JWKS verifier, image store
  src/http.ts        authenticate, per-request transaction, error handler
  src/auth.ts        Supabase JWT verifier (ES256/RS256 only)
  src/authAdmin.ts   Supabase Auth admin client (account deletion)
  src/images.ts      Supabase Storage client (upload, remove, signed URLs)
  src/db/            pool, migration runner, withUser scope, migrations/*.sql
  src/repo/          SQL per entity (goal, task, idea, …)
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

The browser holds the Supabase session and calls the API with a bearer token. The API verifies the token, then runs each request as one Postgres transaction scoped to that user. The API is the only thing that touches the database and the storage bucket; the browser never talks to either directly.

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

These design decisions hold the architecture together:

- **RLS is the isolation boundary**: every table has a `user_id` column that defaults to `current_setting('app.user_id')`, and a policy that limits `mushpoint_app` to rows with that id. Repository SQL has no per-query user filter. Another user's id answers 404, never data.
- **The API role can't bypass RLS**: the API connects as `mushpoint_app` (`NOBYPASSRLS`). Migrations run separately as the database owner.
- **Supabase's Data API can't read the tables**: policies apply only to `mushpoint_app`, and the migrations revoke table access from Supabase's `anon` and `authenticated` roles.
- **One origin**: the client calls `/api` on its own origin, and the Vite dev and preview servers proxy it to port 3000. The API needs no Cross-Origin Resource Sharing (CORS) setup.
- **Time zones come from the client**: to work out “today”, the server takes its own clock and converts it to the user's Internet Assigned Numbers Authority (IANA) time zone from the `X-Timezone` header. The client sends only the zone name, never its own date or time.


## Auth flow

Sign-in happens entirely between the browser and Supabase, using email and password with PKCE. Every email link (sign-up confirmation, password reset, email change) lands on `/auth/callback`, which exchanges the code for a session. The API has no auth endpoints; it only verifies tokens.

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

The API checks 4 things on every token:

- The algorithm is `ES256` or `RS256`. A Supabase project still on the legacy HS256 shared secret fails closed: every request answers 401.
- The issuer is `${SUPABASE_URL}/auth/v1` and the audience is `authenticated`.
- `sub` is a UUID; it becomes the user id.
- The user isn't in `deleted_users`. Access tokens stay valid until they expire, so this tombstone check is what locks out a deleted account.

[`app/README.md`](app/README.md#how-sign-in-reaches-the-api) describes the client side (route guard, PKCE callback, 401 handling), and [`docs/auth.md`](docs/auth.md) covers each step in detail.

### Account deletion

`DELETE /api/account` runs 4 steps in order, then answers 204:

1. Write a tombstone to `deleted_users`
2. Remove every image under `user_id/` in the bucket
3. Delete every row the user owns
4. Delete the Supabase login through the Auth admin API

Each step is idempotent. If one fails partway (503 when Storage or Auth is down), the tombstone has already locked the account out, and the client retries the deletion on its next load. This route is the only one that skips the tombstone check, so the retry can get through.

## Request lifecycle

Every API request passes through the same middleware chain. This flowchart shows where authentication, the per-user transaction and error handling happen:

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

A few details the flowchart leaves out:

- **One transaction per request**: `withUser` opens a transaction, sets `app.user_id` with `set_config(..., true)` (transaction-local), runs the route and commits. Any error rolls it back.
- **First-request bootstrap**: if the user has no `settings` row yet, the same transaction creates it plus the 5 default categories. A transaction-level advisory lock keyed on the user id keeps 2 parallel first requests from creating duplicates.
- **Slow work happens after commit**: signing image URLs and removing replaced images run after `COMMIT`, so they never hold a transaction open. The server logs an `afterCommit` failure instead of sending it to the client.
- **The server reads `X-Timezone` lazily**: the client always sends it. Routes that work out today's date (`GET /goals`, `GET /goals/:id`, `GET /tasks`, `GET /streaks`, `PUT /tasks/:id/completion`) answer 400 if it's missing or isn't a valid IANA time zone.
- **Errors are always `{ "kind", "message" }`**: 400 `validation` (including malformed JSON, oversized bodies, bad uploads, unique violations), 401 `unauthenticated`, 404 `not_found`, 500 `internal`/`database` (the message is always `internal error`), 503 `unavailable`.

## Data model

The schema lives in [`server/src/db/migrations/`](server/src/db/migrations). The migration runner applies files in filename order and records each one in `schema_migrations`.

### Why data is split between Supabase and Postgres

Supabase owns identity and files. Mushpoint's own Postgres owns everything else. The 2 sides share 1 value: the Supabase user id, a UUID, which every app table stores as `user_id`.

The split comes from these reasons:

- **Auth is a solved problem**: Supabase stores passwords and handles sessions, email confirmation and password reset. The project avoids hand-rolling anything a free service already does well.
- **One API owns the business rules**: progress, streaks and validation live in the Express API, so every future client (web, desktop, mobile) shares them. Clients never query the database directly, and the migrations revoke table access from Supabase's `anon` and `authenticated` roles so its auto-generated Data API can't reach the tables.
- **Plain Postgres runs anywhere**: there's no foreign key into Supabase's `auth` schema, so local development and tests run on a stock `postgres:16` container with no Supabase schema. The planned hosted setup points the same migrations at Supabase Postgres.
- **Loose coupling limits lock-in**: auth accounts are the hardest part to move off Supabase. Keeping the link to a single UUID column means the app data is plain Postgres you can move anywhere.
- **Learning Kubernetes**: the API runs as its own server so it can be deployed to a cluster. Clients calling Supabase directly with RLS would be cheaper and was rejected for this reason alone.

### Tables

In the diagram below, **green** entities live in Supabase and **blue** tables live in Mushpoint's Postgres. Dashed lines are logical links with no foreign key: RLS enforces the `user_id` link, and the `*_path` columns hold object paths in the private `vision` bucket.

There's no users table: `user_id` is the Supabase user id, with no foreign key to Supabase's `auth.users`. The repos format timestamps and dates as ISO strings stored as `text`, and boolean-like columns are `integer`.

```mermaid
erDiagram
    SUPABASE_AUTH_USER ||..o{ SUPABASE_STORAGE_OBJECT : "path prefix userId/"
    PROFILES |o..o| SUPABASE_STORAGE_OBJECT : "avatar_path"
    GOALS |o..o| SUPABASE_STORAGE_OBJECT : "motivation_image_path"
    VISION_ITEMS |o..o| SUPABASE_STORAGE_OBJECT : "image_path"

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
        uuid id PK "auth.users, owned by Supabase"
    }
    SUPABASE_STORAGE_OBJECT {
        text path PK "userId/uuid.ext in bucket vision"
    }
    PROFILES {
        uuid user_id PK
        text username "unique, case-insensitive"
        text avatar_path
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

    classDef supabase fill:#d1f5e4,stroke:#1f9d63,stroke-width:2px,color:#0b3d24
    classDef postgres fill:#dbe7f3,stroke:#336791,stroke-width:2px,color:#0f2740
    class SUPABASE_AUTH_USER,SUPABASE_STORAGE_OBJECT supabase
    class PROFILES,SETTINGS,CATEGORIES,GOALS,SUBGOALS,TASKS,TASK_COMPLETIONS postgres
    class IDEAS,IDEA_TAGS,IDEA_TAG_LINKS,VISION_ITEMS,DELETED_USERS postgres
```

Each migration file adds one piece of the schema:

| File | What it does |
|---|---|
| `0001_init.sql` | Creates the `mushpoint_app` role, every core table, indexes, and the `own_rows` RLS policy on each table (`ENABLE` and `FORCE`). |
| `0002_policies_app_role_only.sql` | Re-creates the policies for `mushpoint_app` only, and revokes table access from Supabase's `anon` and `authenticated` roles if they exist. |
| `0003_profiles.sql` | Adds `profiles` (one username per user, unique case-insensitively) with RLS. |
| `0004_deleted_users.sql` | Adds the `deleted_users` tombstone table. It has no RLS, since the API checks any user id against it; `mushpoint_app` can only `SELECT` and `INSERT`. |
| `0005_profile_avatar.sql` | Adds `profiles.avatar_path`, the profile picture's path in the image bucket. |

Migrations only add. Apply them before you deploy a server version that needs them; the previous server version keeps working on the migrated database.

## API overview

Every route lives under `/api`. Request and response bodies are JSON, except image uploads, which are multipart. Every route except `healthz` and `readyz` needs `Authorization: Bearer your_supabase_access_token`.

The routes, grouped by entity:

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
| Profile | `GET /profile`, `PUT /profile/username`, `PUT /profile/avatar` (multipart `file`), `DELETE /profile/avatar` |
| Account | `DELETE /account` |

[`server/src/types.ts`](server/src/types.ts) defines the request and response types once, and [`app/src/lib/api/types.ts`](app/src/lib/api/types.ts) mirrors them. A server test keeps the 2 files byte-identical.

## API to DB Terminology

- **Pool**: one `pg.Pool`, created once at startup in `server/src/main.ts` and shared by every request. It keeps up to 10 open connections (`max` in `server/src/db/pool.ts`), lends one to each request, and replaces any connection the server drops. When all 10 are busy, a request waits in the pool's queue for up to 10s before it fails.

- **Connection**: one open session with Postgres, borrowed from the pool for exactly one request. A connection runs one query at a time, and the transaction and the `app.user_id` setting belong to it. That's why each request needs its own: sharing one would mix users' transactions and break RLS isolation. `withUser` in `server/src/db/scope.ts` returns it to the pool after `COMMIT` or `ROLLBACK`.

- **Driver**: a thin wrapper around the borrowed connection, created per request by `createPgDriver` in `server/src/db/pgDriver.ts`. It has no connection of its own. It exposes 2 methods, `select` for reads and `execute` for writes, and rewrites `?1` placeholders to Postgres's `$1`. Repository code only ever sees the driver, never `pg` itself.

## Local development

Local development runs Postgres in Docker, the API and the web client on your machine, and a hosted Supabase project for sign-in and images.

### Prerequisites

You need:

- Node 24 or newer
- Docker, for the local Postgres
- A Supabase project with:
  - asymmetric JWT signing keys (JWKS) enabled
  - **Confirm email** and **Secure email change** turned on
  - redirect URLs `http://localhost:5173/auth/callback` (dev) and `http://localhost:4173/auth/callback` (preview and e2e)
  - a **private** Storage bucket named `vision` (the [server README](server/README.md#supabase-setup) has a `curl` command that creates it)

### 1. Start the database and the API

Copy the example environment file, then fill in `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`:

```sh
cd server
cp .env.example .env
```

Install dependencies, start Postgres 16 on `localhost:54329`, and apply the migrations. `db:up` waits until the database is healthy, and `migrate` runs as the owner and sets the `mushpoint_app` password:

```sh
npm install
npm run db:up
npm run migrate
```

Start the API on `http://localhost:3000`. It restarts when you change a file:

```sh
npm run dev
```

Check it with `curl localhost:3000/api/healthz`, which returns `{"status":"ok"}`, and `curl localhost:3000/api/readyz`, which returns `{"status":"ready"}`.

### 2. Start the web client

Copy the runtime config, then fill in `supabaseUrl` and `supabaseAnonKey`. Leave `apiUrl` as `/api`:

```sh
cd app
cp static/config.example.json static/config.json
```

Install dependencies and start the dev server on `http://localhost:5173`. It proxies `/api` to port 3000:

```sh
npm install
npm run dev
```

`config.json` is safe to ship to the browser; never put the Supabase service key in it. [`app/README.md`](app/README.md) covers the client in detail.

### Scripts in each package

Both packages expose these npm scripts:

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

Mushpoint has 3 test suites: the server suite, the client unit tests and the Playwright end-to-end suite.

### Server

The server suite runs Vitest against the compose database, and its global setup applies migrations first. Start the database, then run the tests and the type check:

```sh
cd server
npm run db:up
npm test
npm run check
```

The suite runs against real Postgres. It covers the migration runner, RLS policies, the per-user scope and first-request bootstrap (including the parallel-request race), every repository, the pure progress, streak and date logic, the JWT verifier (expired, wrong issuer or audience, foreign key, HS256), config loading, the image store, and every route with 2 users to prove one can never read or change the other's data. Tests sign their own tokens and use an in-memory image store, so they don't need a Supabase project.

### Client unit tests

Run Vitest in watch mode with `npm run test:unit`, once with `npm test`, and type-check with `npm run check`:

```sh
cd app
npm run test:unit
npm test
npm run check
```

Unit tests cover client logic (calendar, Kanban, Gantt, dashboard, dates, optimistic updates, config, images) and the API client with HTTP mocked.

### End-to-end tests

The Playwright suite drives the built app against the real API and a real Supabase project. It creates 2 throwaway users and deletes them afterwards, even when a test fails.

Start and migrate the database, then copy the e2e environment file and fill in `E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_KEY` and `E2E_PASSWORD`:

```sh
cd server && npm run db:up && npm run migrate
cd ../app
cp .env.e2e.example .env.e2e
```

Run the suite:

```sh
npm run test:e2e
```

Playwright starts the API with `npm --prefix ../server run dev`, or reuses one on port 3000. It then builds the app and previews it on port 4173. `static/config.json`, `server/.env` and `.env.e2e` must all point at the same Supabase project. The e2e suite doesn't cover email flows (confirmation, reset, email change); [`app/README.md`](app/README.md#check-email-flows-by-hand) has the manual checklist.

## Deployment and infrastructure

Mushpoint runs only on local machines today. A local Kubernetes cluster is planned next, then a cloud deployment.

### Current setup: local development

Nothing runs in a hosted environment yet. Local development uses 4 pieces:

- **Postgres** in Docker via [`server/docker-compose.yml`](server/docker-compose.yml) (`postgres:16`, host port 54329). It's the only service in the compose file.
- **The API** on the host with `npm run dev`, or as a container built from [`server/Dockerfile`](server/Dockerfile).
- **The web client** on the host with the Vite dev server (5173) or `vite preview` (4173), both proxying `/api` to port 3000.
- **Supabase** (hosted) for auth and image storage.

The API image is a multi-stage `node:24-slim` build that runs as the non-root `node` user and exposes port 3000. Build and run it with:

```sh
docker build -t mushpoint-api server
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://mushpoint_app:mushpoint_app@host.docker.internal:54329/postgres \
  -e SUPABASE_URL=https://your_project_ref.supabase.co \
  -e SUPABASE_SERVICE_KEY=your_service_key_here \
  mushpoint-api
```

The same image runs migrations: use the command `node dist/db/migrateCli.js` and set `MIGRATE_DATABASE_URL` and `MUSHPOINT_APP_PASSWORD`.

The client builds to static files (`app/build/`, with `index.html` as the SPA fallback). It needs only a static file server plus a `/api` route to the API on the same origin.

### Planned: local Kubernetes (phase 3)

> **Planned, not built.** There's no `deploy/` directory yet. This section follows the roadmap in [`docs/superpowers/plans/2026-11-06-hosted-server.md`](docs/superpowers/plans/2026-11-06-hosted-server.md) (Task 16) and the [hosted-server spec](docs/superpowers/specs/2026-11-06-hosted-server-design.md). Details may change when the phase gets its detailed plan.

The planned cluster has these parts:

- A kind cluster runs ingress-nginx, with host port 8080 mapped to the ingress.
- Everything lives in the `mushpoint` namespace.
- The API Deployment runs 2 replicas of `mushpoint-api`. It reads env from a ConfigMap and a Secret, uses `GET /api/healthz` as the liveness probe and `GET /api/readyz` as the readiness probe, and sets resource requests and limits.
- The web Deployment runs nginx, serving the static build with SPA fallback. It mounts `/config.json` from a ConfigMap, so one image serves any environment.
- The migrate Job runs the API image with `node dist/db/migrateCli.js`, reading `MIGRATE_DATABASE_URL` and `MUSHPOINT_APP_PASSWORD` from the Secret.
- The Ingress routes `/api` to the API service and `/` to the web service on one origin, so CORS isn't needed. It also limits request rates through an ingress annotation; the API process has no rate limiter of its own.
- The database is external (Supabase Postgres); no database runs in the cluster.
- Manifests ship `*.example.yaml` files only, so no secret lands in git. A runbook (`docs/k8s-runbook.md`) will cover create, load images, apply, scale, roll out, roll back and tear down.

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

Phase 4 moves the same manifests to a cloud cluster with a domain and HTTPS, and updates the Supabase redirect URLs for the real origin. It stays out of scope until the local cluster works, and no provider is chosen yet.

## Configuration reference

3 files configure Mushpoint: `server/.env` for the API, `app/static/config.json` for the web client, and `app/.env.e2e` for the end-to-end tests.

### API (`server/.env`)

| Variable | Used by | Required | Meaning |
|---|---|---|---|
| `DATABASE_URL` | API | yes | Connection string for `mushpoint_app` (`NOBYPASSRLS`). Never the owner or a Supabase service role. |
| `SUPABASE_URL` | API | yes | Project URL, such as `https://abcd.supabase.co`. The API derives the issuer and JWKS URL from it. |
| `SUPABASE_SERVICE_KEY` | API | yes | Used only for Storage and the Auth admin API (account deletion). |
| `PORT` | API | no (3000) | Listen port. |
| `IMAGE_BUCKET` | API | no (`vision`) | Storage bucket for vision board images. |
| `MIGRATE_DATABASE_URL` | migrate | yes | Owner connection string, used only by migrations. |
| `MUSHPOINT_APP_PASSWORD` | migrate | yes | Password the migration sets on `mushpoint_app`. |

The API fails fast at startup, naming every missing required variable.

### Web client (`app/static/config.json`)

The client loads this file once at startup, so the same build works in any environment.

| Key | Meaning |
|---|---|
| `apiUrl` | API base path. Keep it `/api` (same origin). |
| `supabaseUrl` | Supabase project URL. |
| `supabaseAnonKey` | Supabase anon (public) key. Safe to ship to the browser. |

### End-to-end tests (`app/.env.e2e`)

| Variable | Meaning |
|---|---|
| `E2E_SUPABASE_URL` | Same Supabase project as the client and server. |
| `E2E_SUPABASE_SERVICE_KEY` | Service key that creates and deletes the throwaway users. Never commit it. |
| `E2E_PASSWORD` | Password for both throwaway users, at least 8 characters. |

## Further reading

These docs go deeper on each part:

- [`app/README.md`](app/README.md): running the client, route guard, project layout, behavior notes
- [`server/README.md`](server/README.md): commands, Supabase setup, container, API conventions, account deletion
- [`docs/auth.md`](docs/auth.md): sign-in, tokens and RLS step by step
- [`docs/superpowers/specs/`](docs/superpowers/specs): design specs, including the [hosted server](docs/superpowers/specs/2026-11-06-hosted-server-design.md) and [web client](docs/superpowers/specs/2026-11-08-phase-2-web-client-design.md)
- [`docs/superpowers/plans/`](docs/superpowers/plans): implementation plans
- [`docs/BUG-LOG.md`](docs/BUG-LOG.md) and [`TODO.md`](TODO.md): known issues and near-term work
