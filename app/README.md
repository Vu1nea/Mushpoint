# Mushpoint

Goal tracker web client: SvelteKit (static SPA) + Tailwind v4. All data lives behind the
Mushpoint API in [`../server`](../server/README.md); this app only talks to it over HTTP.
Plan of record: [`../plans/goal_tracker_plan.md`](../plans/goal_tracker_plan.md).

The last desktop (Tauri + SQLite) version is tagged `desktop-sqlite-final`.

## Running it

1. Copy `static/config.example.json` to `static/config.json` (gitignored) and fill in
   your Supabase project URL and anon key. Leave `apiUrl` as `/api`.
2. Start the API server as described in [`../server/README.md`](../server/README.md). It
   listens on `localhost:3000`; the Vite dev server proxies `/api` to it.
3. Start the client:

```sh
npm install
npm run dev
```

### Supabase settings

Sign-in uses Supabase email + password with the PKCE flow. In the Supabase dashboard
(Authentication):

- **Sign In / Providers → Email:** Confirm email **on**, Secure email change **on**.
- **URL Configuration → Redirect URLs:** add `http://localhost:5173/auth/callback`
  (dev) and `http://localhost:4173/auth/callback` (preview), plus the deployed
  origin's `/auth/callback` when there is one.

Every email link (sign-up confirmation, password reset, email change) lands on
`/auth/callback`, which exchanges the code for a session. PKCE ties the link to the
browser that asked for it, so it must be opened in that same browser.

## Tests

```sh
npm run test:unit     # vitest — pure client logic and the API client (HTTP mocked)
npm run test:e2e      # playwright, needs the setup below
npm run test          # unit tests, run once
npm run check         # svelte-check
```

### End-to-end tests

`npm run test:e2e` drives the built app against the real API and Supabase project. It
creates two throwaway users (`e2e-a-<runId>@example.com`, `e2e-b-<runId>@example.com`) and
deletes them afterwards, even when a test fails.

Prerequisites:

1. `static/config.json` filled in, and `../server/.env` set up, both for the same
   Supabase project (see [`../server/README.md`](../server/README.md)).
2. The server's database up and migrated: `npm run db:up` then `npm run migrate` in
   `../server`.
3. `cp .env.e2e.example .env.e2e` and fill in `E2E_SUPABASE_URL`,
   `E2E_SUPABASE_SERVICE_KEY` (service-role key) and `E2E_PASSWORD`. Same project as above.

Then `npm run test:e2e`. Playwright starts the API (`npm --prefix ../server run dev`, or
reuses one already on port 3000) and builds and previews the app on port 4173. Without
`.env.e2e` the run stops at once and names the missing variables.

## Layout

```
src/lib/auth/         Supabase session (sign-in, callback, token) and public-route rules
src/lib/api/          the one interface routes/components use; one HTTP call per function
src/lib/images.ts     vision image upload (type/size checked before it is sent)
src/lib/theme/        active theme store, persisted via the API and mirrored to localStorage
src/lib/icons/        logical icon names resolved per theme
src/lib/components/   UI components
src/routes/           one folder per screen
static/config.json    runtime config (API base URL, Supabase project), loaded at startup
```

## Things worth knowing

- **Progress is derived, never stored.** A goal averages its direct children —
  subgoals and directly-linked tasks weigh the same, and a subgoal's own value is
  the average of its tasks. Tasks count only when `done`; `in_progress` is 0.
- **Status is not progress.** Completing or archiving a goal is an explicit user
  action, so progress can sit at 100% while the goal stays active.
- **Images** are uploaded to the server, which stores them and returns a short-lived
  signed URL; the server also removes an image when its vision item drops or
  replaces it, so the client never deletes files.
- **Themes** are CSS custom properties from `mushpoint-design/css/theme.css`
  (imported in `src/routes/layout.css`) mapped to Tailwind utilities (`bg-surface`,
  `text-muted`, …). Adding a theme means adding it to the design package, one entry in
  `THEMES` (`src/lib/theme/theme.svelte.ts`), and one in the server's allow-list.
  Components must not hardcode colors.
