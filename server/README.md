# Mushpoint API server

Express API for Mushpoint. Each request runs in one Postgres transaction scoped
to the caller: the verified Supabase user id is written to `app.user_id`, and
row-level security limits every statement to that user's rows. Supabase
provides two things only: access tokens (checked against its JWKS) and image
storage.

## Prerequisites

- Node 24
- Docker (for the local Postgres 16 in `docker-compose.yml`)
- For production: a Supabase project (see below)

## Commands

Copy `.env.example` to `.env` first. The defaults point at the compose database.

| Command | What it does |
|---|---|
| `npm run db:up` | Starts Postgres on `localhost:54329` and waits until it is healthy (`db:down` removes it and its data) |
| `npm run migrate` | Applies `src/db/migrations` as the owner role and creates/updates the `mushpoint_app` role |
| `npm test` | Runs the Vitest suite against the compose database (needs `db:up`; migrations are applied by the test setup) |
| `npm run check` | Type-checks with `tsc --noEmit` |
| `npm run dev` | Runs `src/main.ts` with tsx in watch mode, reading `.env` |
| `npm run build` | Bundles `dist/main.js` and `dist/db/migrateCli.js` with esbuild and copies the migrations |

## Environment

| Variable | Used by | Required | Meaning |
|---|---|---|---|
| `DATABASE_URL` | API | yes | Connection string for role `mushpoint_app` (`NOBYPASSRLS`). Never the owner or a Supabase service role. |
| `SUPABASE_URL` | API | yes | Project URL, e.g. `https://abcd.supabase.co`. A trailing slash is ignored. |
| `SUPABASE_SERVICE_KEY` | API | yes | Service key, used only to call Storage. |
| `PORT` | API | no (3000) | Listen port. |
| `IMAGE_BUCKET` | API | no (`vision`) | Storage bucket for vision board images. |
| `MIGRATE_DATABASE_URL` | migrate | yes | Owner connection string, used only by migrations. |
| `MUSHPOINT_APP_PASSWORD` | migrate | yes | Password the migration sets on `mushpoint_app`. |

## Supabase setup

- **Asymmetric JWT signing keys (JWKS) must be enabled.** The API accepts only
  `ES256`/`RS256` tokens with issuer `<SUPABASE_URL>/auth/v1` and audience
  `authenticated`. A project still on the legacy HS256 shared secret fails
  closed: every request answers 401.
- Create a **private** bucket named `vision` (or set `IMAGE_BUCKET`). Images are
  stored at `<userId>/<uuid>.<png|jpg|webp|gif>` and served through signed URLs
  that expire after one hour.

## Container

```sh
docker build -t mushpoint-api server
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://mushpoint_app:mushpoint_app@host.docker.internal:54329/postgres \
  -e SUPABASE_URL=https://example.supabase.co -e SUPABASE_SERVICE_KEY=dummy \
  mushpoint-api
curl localhost:3000/api/healthz   # {"status":"ok"}
curl localhost:3000/api/readyz    # {"status":"ready"} (checks the database as the app role)
```

On Linux, `--network host` with `localhost` in `DATABASE_URL` works too. The
same image runs migrations with the command `node dist/db/migrateCli.js`.

## API conventions

- Everything lives under `/api`. Every route except `healthz`/`readyz` needs
  `Authorization: Bearer <Supabase access token>`.
- Routes that work out "today" need `X-Timezone: <IANA zone>` (for example
  `America/New_York`): `GET /goals`, `GET /goals/:id`, `GET /tasks`,
  `GET /streaks`, `PUT /tasks/:id/completion`.
- Errors are always `{ "kind": ..., "message": ... }`: 400 `validation`,
  401 `unauthenticated`, 404 `not_found`, 500 `internal`/`database` (the message
  is always `internal error`), 503 `unavailable`.
