# Hosted Mushpoint: API server, database, auth, Kubernetes

Date: 2026-11-06. Status: draft for review.

## Intent and why

Mushpoint is a local-first desktop app: one SQLite file, one implicit user, no
server. The owner wants other people to use it. Anyone should be able to sign
up, log in from a web browser, and manage their own goals and tasks. Desktop
and mobile clients follow later and must be able to use the same accounts and
the same data. The owner also wants to learn and demonstrate deploying a real
service on Kubernetes.

Success: the app is deployed on a Kubernetes cluster, strangers can sign up
and use it from a browser, and the design does not need rework when a desktop
or mobile client is added.

The owner wants to **learn Kubernetes** through this. That is why the API runs
as its own server on the cluster. Supabase Edge Functions, or clients calling
Supabase directly with row-level security, would be simpler and cheaper and
were considered and rejected for this reason alone. Where a choice has a
simpler non-Kubernetes answer, the design still keeps the Kubernetes one,
but should not add Kubernetes features that have no job to do.

## Goals

- Learn Kubernetes by running a real service on it: the deliverable includes
  a short runbook explaining what each manifest does and how to inspect,
  scale, roll out and roll back the app.

- Open email + password signup. Each user sees only their own data.
- A web client (the existing SvelteKit UI) that works against a hosted API.
- One API server owns the business rules (progress, streaks, validation) so
  every future client shares them instead of re-implementing them.
- Runs on Kubernetes: container image(s) plus manifests, proven on a local
  cluster (kind or minikube).
- Prefer a free third-party service over building something ourselves.

## Non-goals

- Sharing or collaboration between users.
- Third-party sign-in (Google, GitHub).
- Migrating existing desktop data. Every account starts empty.
- Changing the desktop app or building the mobile app now.
- Choosing a cloud provider or standing up a cloud cluster during phases 1-3.
  That is phase 4, after everything works locally.

## Anti-goals

- Hand-rolling anything a free service already does well (password storage,
  sessions, file storage, database hosting).
- A design that only works for the browser. The API must be usable by
  non-browser clients.

## Decisions made with the owner

- Web browser first; desktop app (talking to the server) and mobile later.
- Users keep only their own data. No sharing for now.
- Open signup, email + password.
- Fresh start, no data migration.
- Use free hosted services where one fits; the owner was initially wary of
  Supabase but agreed it fits this project.
- Our own API server runs on the cluster and all clients talk to it, rather
  than clients talking straight to the hosted database.
- No cluster exists yet. A local cluster is acceptable for now.

## Builder's calls (the owner has not decided these)

- **Supabase** provides Postgres, auth (email/password, password reset,
  email verification) and file storage. Rationale: one free service covers
  three pieces. Cost: free projects pause when idle and storage is capped;
  auth accounts are the hardest part to move away later. The data itself is
  plain Postgres.
- **API server in TypeScript on Node with Express 5** (the owner knows
  Express and will maintain it; Hono and FastAPI were considered and
  dropped). The existing repo and pure-logic code (`progress`, `streak`,
  `dates`, ~2,500 lines) is ported rather than rewritten, and the server and
  web client share identical API types. Clients send the Supabase access token; the server verifies it
  and derives the user id. Clients never send a user id.
- **Web client stays the SvelteKit SPA** (already `ssr = false`, static
  adapter), with Tauri-specific code (`plugin-sql`, `images.ts`) replaced by
  API calls. It is served as static files from a small web container on the
  cluster.
- **Local cluster first** (kind or minikube); manifests kept
  cloud-agnostic.

### Further builder's calls, made after review

- **Repos move to the server and become Postgres-only.** The desktop app is
  explicitly deferred, and when it comes back it will talk to this API
  rather than keep its own SQLite. So there is no need for one repo layer that
  supports two SQL dialects. The existing desktop code is left untouched for
  now; the repo logic and its tests are ported into the server.
- **Owner key** is the Supabase user id (a UUID) stored as a plain column.
  There is no local users table and no foreign key to `auth.users`, so local
  development and tests run on ordinary Postgres without Supabase's schema.
- **Sign-in happens in the browser against Supabase** (supabase-js: signup,
  login, password reset, email verification). The browser sends the access
  token to our API. The API has no auth endpoints of its own.
- **Token verification** uses Supabase's published signing keys (JWKS), so
  the cluster needs the Supabase project URL, not a shared secret. Tests use a
  locally generated key pair.
- **Email verification** is switched on in Supabase ("Confirm email"), which
  means an unverified user never receives a session token, so the API needs
  no separate check. Abuse protection in this project is Supabase's own
  auth rate limits plus request-rate limiting at the ingress. No limiter in
  the API process.
- **Streak dates:** every request carries the user's IANA timezone in an
  `X-Timezone` header; the server derives "today" and local dates from it and
  never from its own clock. The server trusts the header. A user can falsify their own streaks; that
  harms nobody else.
- **Images:** private storage bucket, served through short-lived signed URLs
  that the API returns with each vision item.

## Current state (what exists)

- `app/` is Tauri + SvelteKit. Data access is TypeScript repositories under
  `app/src/lib/db/repo/`, all written against the `SqlDriver` interface
  (`select`, `execute`); tests use `node:sqlite`.
- Schema is five SQLite migrations in `app/src-tauri/migrations/`: categories,
  goals, subgoals, tasks (with `recurrence`), task_completions, settings
  (single row), ideas, idea_tags, idea_tag_links, vision_items.
- There is no user concept anywhere. `settings` is a single-row table.
- Vision board images are copied to `<appDataDir>/images/` and referenced by
  relative path.

## What changes

**Data model.** Every user-owned table gets an owner (the Supabase user id).
Uniqueness that is global today becomes per-user: category names, idea tag
names. `settings` becomes one row per user. The default categories (Work, Gym,
School, Side Projects, Social) are created per user at first use, not once
globally. Cascade and set-null rules stay.

**Postgres port.** The SQL in the repos is SQLite-flavoured: `?1` style
parameters, `lastInsertId`, `INSERT OR IGNORE`, `datetime('now')`,
`COLLATE NOCASE`, text dates. These must be ported to Postgres equivalents
(`$1`, `RETURNING id`, `ON CONFLICT DO NOTHING`, `now()`, `citext` or
lower-cased unique index). Existing repo tests should keep running against the
new backend so behaviour is proven unchanged.

**Dates and "today".** Streaks depend on a local calendar date
(`completed_on` is deliberately a local date, not a UTC instant). A server
cannot assume its own clock matches the user's day. The client's date or the
user's timezone must reach the server wherever "today" matters (streaks,
dashboard, due dates). Which of the two is a decision for the builder; it must
not silently use server time.

**API surface.** One endpoint group per existing `api/index.ts` function
family (categories, goals, subgoals, tasks, streaks, ideas, vision items,
settings). The web client's `lib/api` module becomes a thin HTTP layer with
the same function names and types, so UI components change little.

**Images.** Vision board images upload to Supabase Storage under a per-user
path and are served by URL. Uploads are validated (type, size) on the server.

**Authorization.** Row-level security is the enforced layer. The server
connects as a restricted, non-owner role (not Supabase's `postgres` or service
role, which bypass RLS). Each request runs in one transaction that first sets
the verified user id (`set_config('app.user_id', ..., true)`); every user
table has a `user_id` column defaulting to that setting and a policy limiting
rows to it. This way repo queries need no hand-written `WHERE user_id = ...`,
so a forgotten filter cannot leak data. No policies are granted to Supabase's
`anon` and `authenticated` roles, so Supabase's auto-generated data API cannot
read the tables. (Revised after review: the earlier draft had the server
filter by user id in every query.)

**Kubernetes.** Container images for the API and the web client. Manifests for
Deployments, Services and an Ingress; configuration and secrets (Supabase URL
and keys) via ConfigMap and Secret; liveness/readiness probes on the API. The
database is external (Supabase), so no database runs in the cluster. Proven
by deploying to a local cluster and completing signup, login and a task flow
in a browser.

## Phases

1. API server + schema + auth + per-user scoping, tested locally against
   Supabase (or local Postgres) with the existing repo tests ported.
2. Web client switched to the API, including image upload and signup/login
   screens.
3. Dockerfiles, Kubernetes manifests, local-cluster deployment, a short
   runbook.
4. Move the same manifests to a cloud cluster so the public can reach it:
   pick a provider (a decision for then, with cost in mind), a domain, HTTPS
   certificates, and the Supabase auth redirect/CORS settings for the real
   URL. The end state of the project is publicly reachable on a cloud
   cluster; phases 1-3 are the stepping stones.

## Left to the builder

Server framework, API route shape and error format, migration tool for
Postgres, how the timezone/date issue is solved, session handling in the
browser (cookie vs. in-memory token), container base images, ingress
controller for the local cluster, how local development and tests run
without hitting the hosted project.

## Out of scope but must not be blocked

Desktop and mobile clients calling the same API with the same Supabase
accounts. The API must therefore authenticate by bearer token and avoid
browser-only assumptions (cookies as the only auth, CORS-only protections).

## Risks

- Free-tier limits and idle pausing on Supabase.
- SQLite→Postgres semantic differences in repo code (case-insensitive
  uniqueness, date handling, id returning).
- Open signup invites abuse: needs rate limiting and email verification
  turned on.
