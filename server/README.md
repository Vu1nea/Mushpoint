# Mushpoint API server

The Mushpoint API is an Express app that runs each request in one Postgres transaction scoped to the caller. It writes the verified Supabase user id to `app.user_id`, and row-level security (RLS) limits every statement to that user's rows. Supabase provides 2 things only: access tokens, which the API checks against Supabase's JSON Web Key Set (JWKS), and image storage.

## Prerequisites

You need:

- Node 24
- Docker, for the local Postgres 16 in `docker-compose.yml`
- A Supabase project for production, set up as described in [Supabase setup](#supabase-setup)

## Server commands

Copy `.env.example` to `.env` first; its defaults point at the compose database. Then use these npm scripts:

| Command | What it does |
|---|---|
| `npm run db:up` | Starts Postgres on `localhost:54329` and waits until it's healthy (`db:down` removes it and its data) |
| `npm run migrate` | Applies `src/db/migrations` as the owner role and creates or updates the `mushpoint_app` role |
| `npm test` | Runs the Vitest suite against the compose database. Needs `db:up`; the test setup applies migrations |
| `npm run check` | Type-checks with `tsc --noEmit` |
| `npm run dev` | Runs `src/main.ts` with tsx in watch mode, reading `.env` |
| `npm run build` | Bundles `dist/main.js` and `dist/db/migrateCli.js` with esbuild and copies the migrations |
| `npm run openapi` | Writes `openapi.json` from the request schemas. Run it after you change a route; `npm test` fails while the file is stale |
| `npm run postman` | Writes the Postman collection from `src/postman.ts`. `npm test` fails while it is stale, or when a route has no step |

## Deploy a new server version

Apply the migrations to the live database with `npm run migrate` **before** you deploy a server version that needs them.

This version needs `0003_profiles`, `0004_deleted_users` and `0005_profile_avatar`. Without them every authenticated request fails, because each one checks `deleted_users` and the profile routes read `profiles.avatar_path`. Migrations only add, so the previous server version keeps working on the migrated database.

## Environment variables

The API and the migration runner read these variables from `.env`:

| Variable | Used by | Required | Meaning |
|---|---|---|---|
| `DATABASE_URL` | API | yes | Connection string for role `mushpoint_app` (`NOBYPASSRLS`). Never the owner or a Supabase service role. |
| `SUPABASE_URL` | API | yes | Project URL, such as `https://abcd.supabase.co`. The API ignores a trailing slash. |
| `SUPABASE_SERVICE_KEY` | API | yes | Service key, used only to call Storage and the Auth admin API (account deletion). |
| `PORT` | API | no (3000) | Listen port. |
| `IMAGE_BUCKET` | API | no (`vision`) | Storage bucket for vision board images. |
| `MIGRATE_DATABASE_URL` | migrate | yes | Owner connection string, used only by migrations. |
| `MUSHPOINT_APP_PASSWORD` | migrate | yes | Password the migration sets on `mushpoint_app`. |

## Supabase setup

The API needs 2 things from your Supabase project:

- **Asymmetric JSON Web Token (JWT) signing keys**: the API accepts only `ES256` or `RS256` tokens with issuer `${SUPABASE_URL}/auth/v1` and audience `authenticated`. A project still on the legacy HS256 shared secret fails closed: every request answers 401.
- **A private Storage bucket**: named `vision`, or whatever you set in `IMAGE_BUCKET`. The API stores images at `user_id/uuid.ext`, where `ext` is `png`, `jpg`, `webp` or `gif`, and serves them through signed URLs that expire after 1 hour.

To create the bucket with the service key, run:

```sh
curl -X POST "$SUPABASE_URL/storage/v1/bucket" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "vision",
    "name": "vision",
    "public": false,
    "file_size_limit": 5242880,
    "allowed_mime_types": [
      "image/png", "image/jpeg", "image/webp", "image/gif"
    ]
  }'
```

The command creates a private bucket with a 5&nbsp;MB size limit that accepts PNG, JPEG, WebP and GIF only.

### Live smoke test results (2026-11-08)

On 2026-11-08 we checked the API against a real Supabase project. These all worked:

- Password sign-in
- Token verification through JWKS (ES256)
- The 5 default categories
- Goals, habits and streaks
- Settings
- Image upload, and signed URLs serving the uploaded bytes
- Object removal when you delete a vision item

Supabase's Data API couldn't read the tables, and the Storage endpoints matched what Task 10 assumed.

One behavior to know: after you delete an object, a signed URL fetched earlier can keep serving the image from Supabase's content delivery network (CDN) cache for a while. Storage no longer holds the object; only the cached copy remains until the URL expires, at most 1 hour later.

## Run the API in a container

Build the image from the repo root, then run it against the compose database:

```sh
docker build -t mushpoint-api server
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://mushpoint_app:mushpoint_app@host.docker.internal:54329/postgres \
  -e SUPABASE_URL=https://your_project_ref.supabase.co \
  -e SUPABASE_SERVICE_KEY=your_service_key_here \
  mushpoint-api
```

Check that it's up:

```sh
curl localhost:3000/api/healthz
curl localhost:3000/api/readyz
```

`healthz` returns `{"status":"ok"}`. `readyz` checks the database as the app role and returns `{"status":"ready"}`.

On Linux, `--network host` with `localhost` in `DATABASE_URL` works too. The same image runs migrations with the command `node dist/db/migrateCli.js`.

## API conventions

The full route list, with every request body and query parameter, is in [`openapi.json`](openapi.json) (OpenAPI 3.1). To try the API by hand, import [`postman/mushpoint.postman_collection.json`](postman/mushpoint.postman_collection.json) into Postman: it signs in with Supabase, then walks through every use case in order, passing new ids from one request to the next. Every route follows the same 4 rules:

- **Base path and auth**: every route lives under `/api`. Every route except `healthz` and `readyz` needs `Authorization: Bearer your_supabase_access_token`.
- **Time zone header**: routes that work out today's date need `X-Timezone` set to an Internet Assigned Numbers Authority (IANA) time zone, such as `America/New_York`. Those routes are `GET /goals`, `GET /goals/:id`, `GET /tasks`, `GET /streaks` and `PUT /tasks/:id/completion`.
- **Error shape**: errors are always `{ "kind": ..., "message": ... }`. The kinds are 400 `validation`, 401 `unauthenticated`, 404 `not_found`, 500 `internal` or `database` (the message is always `internal error`), and 503 `unavailable`.
- **Validation**: each route checks its body and query string against a zod schema in `src/schemas.ts` before any SQL runs. A mismatch is a 400 `validation` whose message names the field, such as `timeframe: Invalid option: expected one of "short"|"mid"|"long"`. Nullable fields are still required, so send `null` explicitly: every `PUT` replaces the whole record, and a key you leave out must not quietly clear a value. Unknown keys are dropped. Rules about meaning (trimming, empty titles, the 10,000-character limit, http(s) URLs, real dates, ownership) live in the repo layer.

## How data export works

`GET /api/account/export` answers with every record stored for the caller, for UK GDPR access and portability requests (Articles 15 and 20):

- `tables`: every row of every table in `USER_TABLES` (`src/repo/account.ts`), columns as stored. Deletion uses the same list, and `repo/account.spec.ts` fails when a table with a `user_id` is missing from it, so a new table is exported and deleted as soon as it is listed.
- `images`: each stored image path (avatar, goal motivation image, vision board) with a signed link valid for 24 hours, signed after the transaction commits.
- The sign-in email is held by Supabase Auth, not this database; the web client adds it to the file as `signInEmail`.

It is limited to 10 requests per user per hour, and a deleted account gets 401 like every other route.

## How account deletion works

`DELETE /api/account` runs 4 steps in order, then answers 204:

1. Record a tombstone in `deleted_users`
2. Remove every image under `user_id/` in the bucket
3. Delete every row the user owns
4. Delete the Supabase login through the Auth admin API

Step 4 calls `DELETE ${SUPABASE_URL}/auth/v1/admin/users/user_id` with the service key; a login that's already gone counts as done. Each step is idempotent, so if a request fails partway (503 `unavailable` when Storage or Auth is down), retry it with the same token.

Access tokens stay valid until they expire, so every other route refuses a token whose user is in `deleted_users` with 401 `account deleted`. The tombstone goes first so a deletion that fails partway still locks the account out. The web client sees that 401 on its next load, retries the deletion and signs out. Without the check, the next request would quietly recreate the user's settings and default categories. `DELETE /api/account` itself skips the check so the retry works.
