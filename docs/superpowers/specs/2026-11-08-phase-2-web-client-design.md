# Phase 2: Mushpoint web client

Date: 2026-11-08. Status: draft for review.

Parent spec: `docs/superpowers/specs/2026-11-06-hosted-server-design.md`.
Roadmap outline: `docs/superpowers/plans/2026-11-06-hosted-server.md`
(Tasks 12-15). Where this document and the outline differ, this document wins.

## Intent and why

Phase 1 shipped the API server (`server/`), proven against a live Supabase
project on 2026-11-08. Phase 2 turns the existing SvelteKit UI in `app/` into a
browser client of that API so strangers can sign up and use Mushpoint from a
browser. Phase 3 then puts it on Kubernetes.

Success: a new user can sign up, confirm their email, pick a username, use
every existing screen (dashboard, goals, tasks, ideas, vision board, settings)
against the hosted API, manage their account, and delete it. A second user
never sees the first user's data. The app still feels responsive even though
every action now crosses the network.

## Goals

- `app/` becomes a web-only client of the `server/` API.
- Sign up, email confirmation, log in, log out, password reset.
- Account management: change username, email, password; delete account.
- Usernames: unique handle per user, shown in the app, editable.
- Responsive feel over the network (optimistic updates where they belong).
- Vision board image upload works in the browser.
- An end-to-end test proving two users stay isolated.

## Non-goals

- Logging in with a username. Login is email + password only for now (see
  "Decisions"). Can be added later as a server login proxy without redoing
  anything here.
- Keeping the Tauri/SQLite desktop build working.
- Offline support, caching layers, or a data-fetching library.
- Third-party sign-in, sharing, data migration (unchanged from parent spec).
- Kubernetes, containers for the web client (phase 3).

## Anti-goals

- Duplicating server business rules (progress, streaks, rollups) in the
  browser to make optimistic updates look complete.
- New visual language. Use existing `mushpoint-design` tokens and components
  (`button`, `field`, `sectionHeading`, `ErrorBanner`, `ConfirmDialog`,
  `FormModal`, theme variables). Only introduce a new component when no
  existing one fits, and say why in the plan.
- Leaking a user's email to anyone else (rules out public username-to-email
  lookup).

## Decisions made with the owner

- **Web-only.** `app/` drops Tauri. The current desktop build is preserved only
  as a git tag created before the cutover. This reverses the parent spec's
  "existing desktop code is left untouched for now"; the parent spec already
  says a future desktop client will talk to the API rather than keep SQLite.
- **Optimistic updates, targeted.** Direct-manipulation actions update the
  thing you touched instantly and let server-computed numbers catch up.
  Form saves, creates, deletes and settings wait for the server honestly.
  (Detail below.)
- **Account features:** edit username, email, password; delete account.
- **Username = unique handle, login by email only.** Username login was
  considered and deferred: it needs a server login proxy, which reverses the
  parent spec's "API has no auth endpoints", puts password guessing on our
  API, and makes Supabase's per-IP login rate limit shared by all users.
- **Screens:** no mockups. Build with existing design tokens and components.

## The design

### 1. Cutover to web-only

- Before any change: tag the current commit `desktop-sqlite-final`.
- `app/src/lib/api/index.ts` and `settings.ts` are rewritten in place as HTTP
  calls with the **same exported names and signatures**, so components barely
  change. Route table: `server/src/routes/*` and `server/src/app.ts`.
- Vision item functions return `VisionItemView` (`VisionItem & { imageUrl }`),
  same shape as `server/src/viewTypes.ts`. `VisionItemView` lives in a separate
  client file, never in `api/types.ts`.
- `app/src/lib/api/types.ts` stays byte-identical to `server/src/types.ts`
  (the server's `types.spec.ts` enforces this).
- One `request<T>(method, path, body?)` helper: prefixes the API base URL,
  sends `Authorization: Bearer <access token>` and
  `X-Timezone: <Intl resolved timeZone>`, sends JSON (or `FormData` for image
  upload), parses `{ kind, message }` error bodies into the existing
  `AppError` (same `kind`), handles 204, and on 401 signs the user out and
  redirects to `/login?next=<current path>`. A network failure (fetch throws)
  becomes an `AppError` with a readable message, not a raw `TypeError`.
- Deleted: `app/src/lib/db/` (repos now live in `server/`), Tauri
  dependencies and plugins, `src-tauri/`, the `test:rust` and `tauri` scripts,
  `@tauri-apps/*` imports, and `.github/workflows/release.yml` (it only
  builds Tauri on `app-v*` tags). `test` script no longer runs Rust tests.
  Client `ErrorKind` gains `unauthenticated` to match the server.
  Specs that only tested deleted code go with it; specs for pure client logic
  (`calendar`, `dashboard`, `format`, `kanban`, `gantt`, ...) stay.
- `images.ts` replaced: picking an image is an `<input type="file"
  accept="image/png,image/jpeg,image/webp,image/gif">`; the chosen file is
  POSTed (multipart field `file`) to `/api/vision-images`, which returns
  `{ imagePath, imageUrl }`. The drawer stores `imagePath` on save and shows
  `imageUrl` as preview. Displaying an item uses `item.imageUrl`. Client-side
  size check (5 MB) before upload for a fast error; server remains the
  authority. Deleting images is the server's job (it already removes objects
  on vision item update/delete), so the client never deletes files.
- `goals/[id]` repo link: plain `<a href target="_blank" rel="noopener
  noreferrer">` instead of `plugin-opener`.
- `+layout.ts` keeps `ssr = false`, static adapter with SPA fallback.
- Theme: `theme.svelte.ts` keeps localStorage as first-paint cache; it only
  reconciles with `getSettings()` once a session exists. Login/signup pages
  use the cached or default theme.

**Config.** `app/src/lib/config.ts` fetches `/config.json` once at startup:
`{ apiUrl, supabaseUrl, supabaseAnonKey }`. One build runs in any environment
(phase 3 mounts this file from a ConfigMap). `app/static/config.json` holds dev
defaults with `apiUrl: "/api"`; the Supabase URL and anon key for dev come from
the owner's project (anon key is public by design, but the committed file uses
placeholders and the real file is gitignored, with a `config.example.json`).
Dev: Vite proxies `/api` to `http://localhost:3000`, matching the single-origin
ingress of phase 3, so no CORS anywhere.

### 2. Responsive feel (optimistic updates)

Today every mutation calls `run(() => apiCall())` then `invalidateAll()`.
Over the network that is two serial round trips before anything moves.

**Optimistic** (the touched item changes instantly; server-computed numbers
like progress %, streak counts, heatmaps update when the background
`invalidateAll()` returns):

- task checkbox (`TaskRow`), including recurring-task completion
- kanban card drag between columns (`KanbanBoard`)
- subgoal checkbox (`SubgoalCard`)
- goal status segment (`GoalStatusSegment`)
- vision board reorder (`vision-board/+page.svelte`)
- streak cell tick (streak/heatmap components that call `setTaskCompletion`)

On failure: revert the local change and show the error through the existing
`ErrorBanner`. Rapid repeated clicks on one item: latest intent wins; a
response for an outdated click is ignored.

**Pessimistic** (wait for the server): drawer/modal saves, creates, deletes,
promote idea, settings, account actions. The submit button shows a saving
state and is disabled; the drawer closes on success; errors stay in the
drawer.

**Loading:** first load of a page shows a quiet loading state. Refetches after
a mutation keep the current data on screen (no flash to empty).

No data-fetching library. A small shared helper is expected (shape left to
the builder) plus edits to the components listed above.

### 3. Auth (Supabase in the browser)

`@supabase/supabase-js` handles sign up, log in, session refresh, password
reset and email change. Session persisted with supabase-js defaults
(localStorage) so reload keeps you logged in. The API never sees passwords.

Routes (web build, all client-rendered):

- `/login`: email + password. Links to sign up and "forgot password".
  Errors: wrong credentials (one generic message), unconfirmed email
  ("check your inbox", with resend), network/server down.
- `/signup`: email + password (+ confirm). After submit: "check your email to
  confirm" state with resend. Password rules: Supabase project setting;
  client mirrors the minimum length for a fast error.
- `/forgot-password`: email field; always shows the same "if an account
  exists, we sent a link" message.
- `/auth/callback`: landing for links in Supabase emails: signup
  confirmation, password recovery (shows a set-new-password form), email
  change confirmation. Ends on the dashboard or `/login` with a message.
- Route guard in `+layout`: no session and not on a public auth route →
  redirect to `/login?next=<path>`. Signed in and on `/login`/`/signup` →
  dashboard. Auth pages render without the sidebar.
- Session expiry: supabase-js refreshes tokens automatically. If refresh
  fails or the API returns 401, sign out and redirect with `next`. Unsaved
  drawer input is lost in that case (accepted).

Supabase project settings the owner configures (documented in the plan and
`app/README.md`): Confirm email ON, secure email change ON, Site URL and
redirect allow-list including `http://localhost:5173/auth/callback` and
`http://localhost:4173/auth/callback`.

### 4. Usernames and account management

**Server additions** (small, phase-1-style tasks inside phase 2):

- Migration: `profiles` table (`user_id uuid` primary key defaulting to
  `app.user_id`, `username` text), RLS policy like every other user table,
  unique index on `lower(username)`. Unique indexes are enforced across all
  rows regardless of RLS, so usernames are globally unique while users still
  cannot read each other's profiles.
- Username rules: 3-30 characters, `a-z 0-9 _ .`, stored as typed, compared
  case-insensitively. Taken → 400 with a clear message.
- `GET /api/profile` → `{ username: string | null }`.
  `PUT /api/profile/username` → sets it (validation + uniqueness).
- `DELETE /api/account`: in order, (1) deletes every storage object under
  `<userId>/`, (2) deletes all the user's rows in one transaction, (3) deletes
  the Supabase auth user via the admin API with the service key the server
  already holds. Returns 204. If step 3 fails after 1-2 succeeded, the user
  is left with an empty account they can delete again (retryable, no data
  leak). Covered by tests like the other routes. Needs a list-by-prefix
  method on `ImageStore`.
- **Deleted-user tombstone.** The API verifies tokens offline, so an access
  token issued before deletion stays valid until it expires (up to 1 hour);
  another tab or device could recreate rows or images nobody can clean up.
  `DELETE /api/account` therefore records the user id in a `deleted_users`
  table (not RLS-scoped, app role may insert/select only) before step 1, and
  every authenticated request rejects a tombstoned id with 401 (one indexed
  lookup inside the existing per-request transaction). Tests: A's old token
  gets 401 after deletion.
- Username uniqueness: the server's unique-violation error on `profiles` maps
  to a specific "that username is taken" message, not the generic one.
- `server/src/types.ts` and the app copy gain the profile types (byte-identity
  test still applies).

**First login:** if `username` is null, the user sees a one-field "pick a
username" step before the app. Required. (Signup cannot set it because no
session exists until email confirmation.)

**Where it shows:** sidebar footer gets a user block (username, sign-out
button, link to account settings), using existing sidebar styles.

**Account section** at the top of the existing `/settings` page (no new
route), using existing `sectionHeading`/`field`/`button`:

- Username: edit, save, "taken" error inline.
- Email: shows current; change → `supabase.auth.updateUser({ email })`; shows
  "confirm from both inboxes" message. Pending change stays visible until
  confirmed.
- Password: current password + new password. Re-verify the current password
  by signing in again, then `updateUser({ password })`.
- Delete account: `ConfirmDialog` that requires typing the account email;
  calls `DELETE /api/account`, then signs out locally and lands on `/login`
  with a "account deleted" message. Immediate and permanent.

### 5. Testing and local development

- Unit (Vitest, existing node project): `request()` with mocked `fetch`
  (headers, error mapping, 204, 401 callback, network failure); the
  optimistic helper (apply, revert on failure, stale response ignored);
  session module with supabase-js mocked; username validation.
- Server: profile and account routes tested in `server/` like phase 1 routes,
  including user B cannot read or change user A's profile, username
  uniqueness across users, and delete-account removing rows + objects.
- `npm run check` passes with no `@tauri-apps` left; `npm run build`
  produces a static bundle containing no Tauri code.
- E2E (Playwright, replaces/updates `e2e/shell.e2e.ts`): runs against compose
  Postgres + `server` dev + `vite preview`, authenticating against a real
  Supabase **test** project. Global setup creates two pre-confirmed users via
  the admin API (service key from local env, never committed); teardown
  deletes them. Flow: A logs in, picks username, creates a goal and a task,
  ticks the task (optimistic), uploads a vision image; B logs in and sees none
  of it; A deletes their account and can no longer log in. Signup + real email
  confirmation is a manual check, documented.
- Local dev: `server` against compose Postgres (`npm run db:up`, `migrate`,
  `dev`), `app` via `vite dev` with the `/api` proxy, auth against the
  owner's Supabase project.

## Constraints

- No Tauri anywhere in `app/` after phase 2.
- API surface stays bearer-token based; nothing browser-only on the server.
- Secrets never committed (service key, real config).
- Existing UI patterns and tokens; no visual redesign.

## Left to the builder

- Shape of the optimistic helper and the session module.
- Task order and how to split the cutover so the app stays type-checking
  between commits.
- Exact copy for auth and error messages (follow existing tone).
- Loading-state treatment details within existing styles.

## Builder's calls (owner has not decided these)

- Delete `src-tauri/` (git tag keeps it) rather than leave it dormant.
- Account section lives in `/settings`, not a new `/account` route.
- Username picked on first login, required.
- Username rules (3-30, `a-z 0-9 _ .`, case-insensitive unique).
- Session stored by supabase-js in localStorage (spec left cookie vs memory
  open; localStorage is the supabase-js default and fits the bearer-token API).
- Password change re-verifies the current password.
- Delete account is immediate, confirmed by typing the email.
- `desktop-sqlite-final` tags commit `5023f08` (last commit before phase 2).
  The uncommitted goal-card hover change in `app/src/routes/goals/+page.svelte`
  is not in the tag; it carries into the web version.
- E2E uses a real Supabase project with admin-created users rather than a
  stub JWKS server. The project is whatever the gitignored E2E env file names:
  the owner's dev project works; a separate test project is optional and needs
  the same bucket and auth settings. `npm test` runs unit tests only; E2E runs via
  `npm run test:e2e` locally with credentials from a gitignored env file. No
  CI job in phase 2 (no workflow remains after `release.yml` is removed).
- Deleted-user tombstone table so old tokens die with the account.
- Auth email links use supabase-js's PKCE flow, handled on `/auth/callback`.
- The "pick a username" step is enforced in the client only; the API works
  without a username.
- Real `config.json` gitignored, `config.example.json` committed.

## Risks

- Supabase free projects pause after inactivity; the app then fails every
  request until the project is restored in the dashboard. Client shows the
  network error banner; nothing more to do in phase 2.
- Signed image URLs expire after one hour; a tab left open longer shows broken
  images until the next refetch. Acceptable; a refetch on image error is an
  easy follow-up.
- E2E depends on a live Supabase test project and its rate limits.
