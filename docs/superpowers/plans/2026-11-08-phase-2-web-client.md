# Phase 2: Web Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `app/` into a web-only SvelteKit client of the `server/` API, with Supabase sign-in, usernames, account management (including delete), targeted optimistic updates, and a two-user E2E test.

**Architecture:** `app/src/lib/api/*` keeps its exported names and signatures but becomes HTTP calls through one `request()` helper (bearer token + `X-Timezone`). Supabase auth runs in the browser through one session module; a `+layout.ts` guard redirects to auth pages. The server gains a `profiles` table, profile routes, `DELETE /api/account` and a `deleted_users` tombstone checked at authentication. All Tauri/SQLite code is deleted.

**Tech Stack:** SvelteKit 2 (static adapter, `ssr = false`), Svelte 5 runes, Vite 8, Vitest 4, Playwright, `@supabase/supabase-js` v2 (PKCE); server: Express 5, `pg`, Vitest + supertest, compose Postgres 16.

**Spec:** `docs/superpowers/specs/2026-11-08-phase-2-web-client-design.md` (parent: `docs/superpowers/specs/2026-11-06-hosted-server-design.md`). Branch: `feature/migration-client`.

## Global Constraints

- No `@tauri-apps/*` import, `src-tauri/`, or SQLite code remains in `app/` after Task 4.
- `app/src/lib/api/types.ts` is byte-identical to `server/src/types.ts` (enforced by `server/src/types.spec.ts`). Any type added to one is added to both in the same commit.
- `VisionItemView = VisionItem & { imageUrl: string | null }` lives in `app/src/lib/api/viewTypes.ts`, never in `types.ts`.
- Every API request sends `Authorization: Bearer <access token>` and `X-Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone`.
- API errors are `{ kind, message }`; the client turns them into `AppError` with the same `kind`. Client `ErrorKind` = server `ErrorKind` (`not_found | validation | unauthenticated | database | internal | unavailable`).
- API is same-origin under `/api`. Vite `server.proxy` and `preview.proxy` send `/api` to `http://localhost:3000`. No CORS.
- `/config.json` = `{ apiUrl, supabaseUrl, supabaseAnonKey }`. `app/static/config.json` gitignored; `app/static/config.example.json` committed with placeholders and `"apiUrl": "/api"`.
- Secrets never committed (service keys, real config, `app/.env.e2e`).
- Usernames: trimmed, `^[a-z0-9_.]{3,30}$` case-insensitive, stored as typed, unique case-insensitively across all users. Taken → 400 `that username is taken`.
- Image upload: PNG/JPEG/WebP/GIF, max 5 MB (5 * 1024 * 1024 bytes), multipart field `file`, `POST /api/vision-images` → `{ imagePath, imageUrl }`.
- UI uses existing `mushpoint-design` components/tokens (`button`, `field`, `sectionHeading`, `ErrorBanner`, `ConfirmDialog`, `FormModal`, theme variables). A new component needs a stated reason in its commit message.
- Server style: 2-space indent, no semicolon changes to existing files beyond what the task needs. App style: tabs (Prettier config in repo).

## Review Focus

1. Session expires or token is revoked mid-use → next API call 401s, user lands on `/login?next=<that path>` and returns there after signing in (Task 3 test, Task 5 test).
2. `next` parameter is an attacker URL (`https://evil.example`, `//evil.example`, `/\evil`) → ignored, user goes to `/` (Task 5, `safeNext` test).
3. API server down or network drops → readable `AppError('unavailable', …)` in the banner, never a raw `TypeError: Failed to fetch` (Task 3 test).
4. User double-clicks a task checkbox fast, first response arrives after second click → final UI matches the last click, no revert flicker; error on a stale call is ignored (Task 7 test).
5. Deleted user's still-valid token from another tab → 401 on every route, including image upload; repeating `DELETE /api/account` with that token still succeeds so a half-failed delete is retryable (Task 2 test).

---

## Server

Work in `server/`. Prereq for every server test: `npm run db:up` (tests apply migrations themselves).

### Task 1: Profiles: migration, repo, routes, shared type

**Files:**
- Create: `server/src/db/migrations/0003_profiles.sql`, `server/src/repo/profile.ts`, `server/src/repo/profile.spec.ts`, `server/src/routes/profile.ts`
- Modify: `server/src/types.ts` and `app/src/lib/api/types.ts` (identical addition), `server/src/app.ts` (mount), `server/src/routes/routes.spec.ts` (route tests), `server/src/testSupport/db.ts` (`purgeUsers` also clears `profiles`)

**Interfaces:**
- Produces (types.ts, both copies): `export interface Profile { username: string | null }` and `export const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/i;`
- Produces (repo): `get(driver: SqlDriver): Promise<Profile>` (no row → `{ username: null }`); `setUsername(driver: SqlDriver, raw: string): Promise<Profile>` (trims, validates against `USERNAME_PATTERN` → `AppError.validation('username must be 3-30 letters, numbers, _ or .')`, upserts the caller's row, unique violation `23505` → `AppError.validation('that username is taken')`).
- Produces (routes): `GET /api/profile` → `Profile`; `PUT /api/profile/username` body `{ username: string }` → `Profile`.

Migration `0003_profiles.sql`: table `profiles (user_id uuid PRIMARY KEY DEFAULT current_setting('app.user_id')::uuid, username text NOT NULL, updated_at text NOT NULL)`, `CREATE UNIQUE INDEX profiles_username_lower ON profiles (lower(username))`, RLS enabled + forced, policy `own_rows ... TO mushpoint_app USING (user_id = current_setting('app.user_id')::uuid)`, `GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO mushpoint_app`, and the same guarded `REVOKE ALL ... FROM anon/authenticated` block as `0002`.

- [ ] **Step 1: Write failing repo tests** in `profile.spec.ts` (use `createTestDb` like other repo specs):
  - `get returns null username for a new user` → `{ username: null }`
  - `setUsername trims and stores as typed` → `setUsername(db, '  Vinod.G ')` returns `{ username: 'Vinod.G' }`, then `get` returns the same
  - `setUsername rejects bad names` → `'ab'`, `'a'.repeat(31)`, `'has space'`, `'emoji😀'` each reject with kind `validation`
  - `setUsername can change own name` → set `alpha`, then `beta`; `get` → `beta`
  - `usernames are unique case-insensitively across users` → user A sets `Vinod`; user B `setUsername('vinod')` rejects with message `that username is taken`
  - `a user cannot read another user's profile` → A sets `alpha`; `get` for B → `{ username: null }`
- [ ] **Step 2:** `npx vitest run src/repo/profile.spec.ts` → FAIL (module missing).
- [ ] **Step 3:** Write the migration, add the types to both `types.ts` copies, implement the repo.
- [ ] **Step 4:** Run the spec → PASS. Run `npx vitest run src/types.spec.ts` → PASS.
- [ ] **Step 5: Route tests** in `routes.spec.ts`: `GET /api/profile` for a fresh user → 200 `{ username: null }`; `PUT /api/profile/username` `{ username: 'alpha_1' }` → 200 `{ username: 'alpha_1' }`; B putting `ALPHA_1` → 400 `{ kind: 'validation', message: 'that username is taken' }`; missing body field → 400. Implement `routes/profile.ts` with `handle`, mount at `/profile`. Run → PASS.
- [ ] **Step 6:** `npm test && npm run check` → all PASS. Commit `feat(server): user profiles with unique usernames`.

### Task 2: Delete account and deleted-user tombstone

**Files:**
- Create: `server/src/db/migrations/0004_deleted_users.sql`, `server/src/authAdmin.ts`, `server/src/authAdmin.spec.ts`, `server/src/repo/account.ts`, `server/src/routes/account.ts`
- Modify: `server/src/images.ts` (+ `images.spec.ts`), `server/src/http.ts` (`authenticate`), `server/src/app.ts` (`Deps`, mounting), `server/src/main.ts`, `server/src/app.spec.ts` and `routes.spec.ts` (`createApp` calls), `server/src/testSupport/db.ts` (`purgeUsers` clears `deleted_users`), `server/README.md` (endpoint + admin API note)

**Interfaces:**
- Consumes: `withUser`, `makeHandle`, `ImageStore` (existing); `profiles` table (Task 1).
- Produces:
  - `ImageStore.removeAllFor(userId: string): Promise<void>` — deletes every object under `<userId>/`; no-op when none. Supabase impl: `POST /storage/v1/object/list/<bucket>` with `{ prefix: userId, limit: 1000, offset }` paged until a short page, then `DELETE /storage/v1/object/<bucket>` with `{ prefixes: ['<userId>/<name>', ...] }`. Memory store: drops keys starting with `<userId>/`.
  - `authAdmin.ts`: `interface AuthAdmin { deleteUser(userId: string): Promise<void> }`; `createSupabaseAuthAdmin({ url, serviceKey, fetch? }): AuthAdmin` → `DELETE <url>/auth/v1/admin/users/<userId>` with `apikey` + `Authorization: Bearer <serviceKey>`; 200 and 404 both succeed; other status or network error → `AppError('unavailable', 'could not delete the login')`. `createMemoryAuthAdmin(): AuthAdmin & { deleted: string[] }` for tests.
  - `repo/account.ts`: `deleteAllRows(driver: SqlDriver): Promise<void>` deletes the caller's rows from `idea_tag_links, idea_tags, ideas, task_completions, tasks, subgoals, goals, vision_items, categories, settings, profiles` (RLS scopes them), then `INSERT INTO deleted_users (user_id, deleted_at) VALUES (current_setting('app.user_id')::uuid, now()) ON CONFLICT DO NOTHING`.
  - `authenticate(verify: Verifier, isDeleted?: (userId: string) => Promise<boolean>): RequestHandler` — when `isDeleted` is given and returns true → `AppError.unauthenticated('account deleted')`.
  - `Deps` gains `authAdmin: AuthAdmin`.
  - Route `DELETE /api/account` → 204. Order: `images.removeAllFor(userId)`, then `withUser(... deleteAllRows)`, then `authAdmin.deleteUser(userId)`. Mounted **before** the tombstone-checking `authenticate`, with `authenticate(verify)` (no tombstone check) so a retry works.

Migration `0004_deleted_users.sql`: `deleted_users (user_id uuid PRIMARY KEY, deleted_at timestamptz NOT NULL)`, no RLS, `GRANT SELECT, INSERT ON deleted_users TO mushpoint_app`, guarded anon/authenticated revoke as in `0002`.

- [ ] **Step 1: Failing tests.**
  - `images.spec.ts`: memory `removeAllFor(A)` removes A's two objects, leaves B's; Supabase impl with mocked fetch sends the list call with `prefix: A` then one delete with both full paths; empty list → no delete call.
  - `authAdmin.spec.ts` (mocked fetch): sends `DELETE …/auth/v1/admin/users/<id>` with both headers; 404 resolves; 500 rejects with kind `unavailable`.
  - `routes.spec.ts` new `describe('account deletion')`: A creates a goal, a task, a vision item with an uploaded image, sets username; B creates a goal. `DELETE /api/account` as A → 204. Then: `authAdmin.deleted` equals `[A]`; memory store has no `A/` keys; querying each table as owner for `user_id = A` returns 0 rows; B's goal still listed for B; A's `GET /api/goals` → 401; A's `POST /api/vision-images` → 401; A's `DELETE /api/account` again → 204; username A held is now free (B can take it).
- [ ] **Step 2:** Run the three specs → FAIL.
- [ ] **Step 3:** Implement migration, `removeAllFor`, `authAdmin.ts`, `account.ts`, `authenticate` change, route, `Deps` + `app.ts` mounting (`api.delete('/account', authenticate(verify), …)` before `api.use(authenticate(verify, isDeleted))`, where `isDeleted` runs `SELECT 1 FROM deleted_users WHERE user_id = $1` on the pool), `main.ts` builds `createSupabaseAuthAdmin` from config. Update existing `createApp` calls with `authAdmin: createMemoryAuthAdmin()`.
- [ ] **Step 4:** `npm test && npm run check` → PASS. Commit `feat(server): delete account with deleted-user tombstone`.

---

## Client

Work in `app/`.

### Task 3: HTTP client, config, error module

Added alongside the old code; nothing deleted yet.

**Files:**
- Create: `app/src/lib/api/error.ts` (moved content of `lib/db/error.ts`), `app/src/lib/api/http.ts`, `app/src/lib/api/http.spec.ts`, `app/src/lib/config.ts`, `app/src/lib/config.spec.ts`, `app/static/config.example.json`
- Modify: `app/.gitignore` (`/static/config.json`, `!.env.e2e.example`), `app/vite.config.ts` (`server.proxy` and `preview.proxy`: `'/api': 'http://localhost:3000'`)

**Interfaces:**
- Produces:
  - `error.ts`: `ErrorKind` (adds `'unauthenticated'`), `AppError` with existing members plus `static unauthenticated(message: string)`.
  - `config.ts`: `interface AppConfig { apiUrl: string; supabaseUrl: string; supabaseAnonKey: string }`; `loadConfig(fetchFn?: typeof fetch): Promise<AppConfig>` fetches `/config.json` once and caches; a missing field rejects with `AppError('internal', 'config.json is missing <field>')`.
  - `http.ts`: `configureHttp(opts: { apiUrl: string; getAccessToken: () => Promise<string | null>; onUnauthenticated: () => void; fetch?: typeof fetch }): void`; `request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T>`. `FormData` bodies are sent as-is (no JSON content-type); other bodies JSON. 204 → `undefined`. Non-2xx with `{kind,message}` → `AppError(kind, message)`; non-JSON error → `AppError('internal', 'unexpected response (<status>)')`. Fetch throws → `AppError('unavailable', 'Could not reach Mushpoint. Check your connection and try again.')`. 401 → calls `onUnauthenticated()` then rejects with the `AppError`. No token → request sent without `Authorization` (server answers 401).

- [ ] **Step 1: Failing tests** (`http.spec.ts`, mocked fetch):
  - sends `Authorization: Bearer tok` and an `X-Timezone` equal to `Intl.DateTimeFormat().resolvedOptions().timeZone`; URL is `apiUrl + path`
  - JSON body sent with `content-type: application/json`; `FormData` body sent without it
  - 204 resolves `undefined`
  - 400 `{kind:'validation',message:'bad'}` rejects `AppError` kind `validation`, message `bad`
  - 401 calls `onUnauthenticated` once and rejects kind `unauthenticated`
  - fetch throwing `TypeError` rejects kind `unavailable` with the exact message above
  - 502 with HTML body rejects kind `internal`, message `unexpected response (502)`
  - `config.spec.ts`: valid JSON resolves; second call does not refetch; missing `supabaseAnonKey` rejects with `config.json is missing supabaseAnonKey`
- [ ] **Step 2:** `npx vitest run src/lib/api/http.spec.ts src/lib/config.spec.ts` → FAIL.
- [ ] **Step 3:** Implement. `lib/db/error.ts` becomes `export * from '../api/error';` until Task 4 deletes it.
- [ ] **Step 4:** Specs → PASS; `npm run check` → PASS. Commit `feat(web): http client, runtime config and error kinds`.

### Task 4: Web-only cutover

**Files:**
- Modify: `app/src/lib/api/index.ts`, `app/src/lib/api/settings.ts` (rewritten as HTTP), `app/src/lib/components/VisionImage.svelte`, `VisionItemDrawer.svelte`, `VisionBoard.svelte`, `DashboardVisionPreview.svelte`, `app/src/routes/goals/[id]/+page.svelte`, `app/package.json`, `app/README.md`
- Create: `app/src/lib/api/viewTypes.ts`, `app/src/lib/api/account.ts`, `app/src/lib/api/index.spec.ts`, `app/src/lib/images.ts` (replaced), `app/src/lib/images.spec.ts` (replaced)
- Delete: `app/src/lib/db/`, `app/src-tauri/`, `.github/workflows/release.yml`

**Interfaces:**
- Consumes: `request`, `AppError` (Task 3); `Profile` (Task 1).
- Produces:
  - `index.ts` / `settings.ts`: every existing export keeps its name and signature, except vision functions return `VisionItemView` / `VisionItemView[]`. Paths, query and body names come from `server/src/routes/*.ts` and `server/src/app.ts`. `index.ts` re-exports `./types`, `./viewTypes`, `AppError`, `ErrorKind` from `./error`.
  - `account.ts`: `getProfile(): Promise<Profile>`, `setUsername(username: string): Promise<Profile>`, `deleteAccount(): Promise<void>`.
  - `images.ts`: `MAX_IMAGE_BYTES = 5 * 1024 * 1024`, `ACCEPTED_IMAGE_TYPES = ['image/png','image/jpeg','image/webp','image/gif']`, `uploadImage(file: File): Promise<{ imagePath: string; imageUrl: string | null }>` — rejects `AppError.validation('Choose a PNG, JPEG, WebP or GIF image.')` on wrong type and `AppError.validation('Images must be 5 MB or smaller.')` when larger, before any request; otherwise `request('POST', '/vision-images', formData)`.
  - `VisionImage.svelte` props become `{ src: string | null; alt?: string; class?: string }`; renders nothing when `src` is null.
  - `VisionItemDrawer.svelte`: hidden `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif">` triggered by the existing pick button; on change calls `uploadImage`, stores `imagePath` in the form and shows `imageUrl` as preview; error goes to the drawer's existing `error`.

- [ ] **Step 0:** `git tag desktop-sqlite-final 5023f08`. Do not stage `app/src/routes/goals/+page.svelte` unless this task changes it.
- [ ] **Step 1: Failing tests.**
  - `index.spec.ts` (mock `request` via `vi.mock('./http')`), one per route family, asserting method, path and body: `listGoals('active')`, `deleteGoal(3, true)`, `setTaskCompletion(5, true, '2026-11-08')`, `listStreaks(14)`, `listIdeas({ tag: 'x', includePromoted: true })`, `promoteIdea(2, 9)`, `reorderVisionItems([3,1])`, `setStreakGraceDays(2)`, `setUsername('alpha')`, `deleteAccount()`.
  - `images.spec.ts`: 6 MB file rejects with the size message and `request` not called; `text/plain` rejects with the type message; valid PNG posts `FormData` whose `file` entry is the file, resolves server response.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement the API files and `images.ts`. Update image components (`VisionBoard`/`DashboardVisionPreview` pass `item.imageUrl`). Repo link in `goals/[id]`: `<a href={goal.repoUrl} target="_blank" rel="noopener noreferrer">` keeping existing classes. Delete `lib/db/`, `src-tauri/`, `release.yml`; remove the five `@tauri-apps/*` deps and `@tauri-apps/cli`, scripts `tauri` and `test:rust`; `test` becomes `npm run test:unit -- --run`. Remove specs that only covered deleted code. Rewrite `app/README.md` dev section: copy `static/config.example.json` → `static/config.json`, start server (`server/README.md`), `npm run dev`.
- [ ] **Step 4:** `npm run test:unit -- --run` → PASS; `npm run check` → PASS; `npm run build` → PASS; `grep -r "tauri" build/` → no matches; `cd ../server && npx vitest run src/types.spec.ts` → PASS.
- [ ] **Step 5:** Commit `feat(web)!: web-only client on the hosted API`.

### Task 5: Auth: session module, auth pages, route guard

**Files:**
- Create: `app/src/lib/auth/session.svelte.ts`, `app/src/lib/auth/session.spec.ts`, `app/src/lib/auth/routes.ts`, `app/src/lib/auth/routes.spec.ts`, `app/src/routes/login/+page.svelte`, `app/src/routes/signup/+page.svelte`, `app/src/routes/forgot-password/+page.svelte`, `app/src/routes/auth/callback/+page.svelte`
- Modify: `app/src/routes/+layout.ts`, `app/src/routes/+layout.svelte`, `app/src/lib/theme/theme.svelte.ts`, `app/package.json` (`@supabase/supabase-js`), `app/README.md` (Supabase settings)

**Interfaces:**
- Consumes: `loadConfig`, `configureHttp` (Task 3); `getProfile` (Task 4).
- Produces:
  - `session.svelte.ts`: `initAuth(config: AppConfig): void` (creates the client with `{ auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: false } }` and subscribes to auth changes); `auth` object with reactive `session: Session | null` and `email: string | null`; `getAccessToken(): Promise<string | null>`; `signUp(email, password): Promise<void>` (`emailRedirectTo: origin + '/auth/callback?type=signup'`); `signIn(email, password): Promise<void>`; `signOut(): Promise<void>`; `resendConfirmation(email): Promise<void>`; `requestPasswordReset(email): Promise<void>` (`redirectTo: origin + '/auth/callback?type=recovery'`); `completeCallback(url: URL): Promise<'signed_in' | 'recovery' | 'email_changed' | 'error'>` (exchanges `code` for a session, returns by `type`); `setNewPassword(password): Promise<void>`. Supabase errors become `AppError`: `invalid_credentials` → validation `Email or password is incorrect.`; `email_not_confirmed` → validation `Confirm your email first. Check your inbox.`; anything else → `unavailable` with Supabase's message.
  - `routes.ts`: `PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password', '/auth/callback']`; `isPublicRoute(pathname: string): boolean`; `safeNext(raw: string | null): string` returns `raw` only if it starts with a single `/` and not `//` or `/\`, else `'/'`.
  - `+layout.ts` `load({ url })`: `loadConfig` → `initAuth` → `configureHttp({ apiUrl, getAccessToken, onUnauthenticated: () => signOut().then(() => goto('/login?next=' + encodeURIComponent(location.pathname))) })` (once). No session and not public → `redirect(307, '/login?next=' + path)`. Session and on `/login` or `/signup` → `redirect(307, '/')`. Session → returns `{ profile: await getProfile() }`; `{ profile: null }` otherwise. (Task 6 adds the `/welcome` redirect.)
  - `+layout.svelte`: public routes and `/welcome` render `children` centered without the sidebar; other routes keep today's shell. A thin top progress bar while `navigating.to` is set (existing accent token).
  - `theme.init()` only reads `getSettings()` when `auth.session` is set; otherwise cached/default theme.

- [ ] **Step 1: Failing tests.**
  - `routes.spec.ts`: `safeNext('/goals/3')` → `/goals/3`; `safeNext('https://evil.example')`, `safeNext('//evil.example')`, `safeNext('/\\evil')`, `safeNext(null)` → `/`; `isPublicRoute('/auth/callback')` true, `isPublicRoute('/goals')` false.
  - `session.spec.ts` (mock `@supabase/supabase-js` `createClient`): `getAccessToken` null when no session; returns `access_token` after `signIn`; `signOut` makes it null; `signIn` with Supabase error code `invalid_credentials` rejects with the exact message above; `completeCallback(new URL('http://x/auth/callback?type=recovery&code=c'))` calls `exchangeCodeForSession('c')` and returns `recovery`; missing code → `error`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement module, layout guard, pages. Pages use `field`, `button`, `ErrorBanner`. Login: email, password, links to signup and forgot; on `email_not_confirmed` show a "Resend email" button. Signup: email, password, confirm password (client checks match and length ≥ 8), then a "Check your email to confirm your account" state with resend. Forgot: always shows `If an account exists for that email, we sent a reset link.` Callback: `recovery` shows a new-password form then goes to `/`; `signed_in` → `/`; `email_changed` → `/settings` ; `error` → message + link to `/login`. After login go to `safeNext(url.searchParams.get('next'))`.
- [ ] **Step 4:** `npm run test:unit -- --run && npm run check` → PASS.
- [ ] **Step 5: Manual check** (dev server + API + owner's Supabase project, settings from README: Confirm email ON, Secure email change ON, redirect URLs `http://localhost:5173/auth/callback`, `http://localhost:4173/auth/callback`): sign up → confirm via email → lands signed in; reload keeps session; sign out → `/login`; visiting `/tasks` signed out → `/login?next=%2Ftasks` → after login lands on `/tasks`; forgot password → link → new password works.
- [ ] **Step 6:** Commit `feat(web): supabase sign-in, auth pages and route guard`.

### Task 6: Usernames and account management UI

**Files:**
- Create: `app/src/routes/welcome/+page.svelte`, `app/src/lib/components/AccountSettings.svelte`, `app/src/lib/components/SidebarUser.svelte`
- Modify: `app/src/routes/+layout.svelte` (sidebar footer), `app/src/routes/settings/+page.svelte` (Account section first), `app/src/lib/auth/session.svelte.ts` (+ spec)

**Interfaces:**
- Consumes: `getProfile`, `setUsername`, `deleteAccount` (Task 4); `auth`, `signIn`, `signOut` (Task 5); `USERNAME_PATTERN` (Task 1); layout data `profile` (Task 5).
- Produces (session module): `changeEmail(newEmail: string): Promise<void>` (`updateUser({ email }, { emailRedirectTo: origin + '/auth/callback?type=email_change' })`); `changePassword(current: string, next: string): Promise<void>` (re-verifies with `signInWithPassword(auth.email, current)`; failure → validation `Current password is incorrect.`; then `updateUser({ password: next })`).
- `+layout.ts` guard addition: session and `profile.username === null` and path ≠ `/welcome` → `redirect(307, '/welcome')`; session with a username on `/welcome` → `redirect(307, '/')`.
- `/welcome`: one username field, validated client-side with `USERNAME_PATTERN`, submit → `setUsername` → `invalidateAll()` → `goto('/')`. Server errors (taken) shown inline.
- `SidebarUser.svelte`: username (falls back to email), Settings link, Sign out button; collapses to an icon in the rail state like other sidebar items. New component reason: the sidebar has no user block today.
- `AccountSettings.svelte` (inside `/settings`, `sectionHeading` "Account"): username edit; email row showing `auth.email` + change form → message `Check both inboxes to confirm the change.`; password form (current, new, confirm, length ≥ 8); "Delete account" opens `ConfirmDialog` whose confirm button is disabled until the typed text equals `auth.email`; confirm → `deleteAccount()` → `signOut()` → `goto('/login?deleted=1')`; login page shows `Your account was deleted.` when `deleted=1`. New component reason: keeps the settings page file from doubling in size.

- [ ] **Step 1: Failing tests** (`session.spec.ts`): `changePassword` with wrong current password rejects `Current password is incorrect.` and never calls `updateUser`; correct path calls `updateUser({ password: 'newpass123' })`; `changeEmail` passes `emailRedirectTo` ending in `/auth/callback?type=email_change`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement module functions, then the three UI pieces. **Step 4:** `npm run test:unit -- --run && npm run check` → PASS.
- [ ] **Step 5: Manual check:** new user is sent to `/welcome`; taken name shows the server error; sidebar shows username; rename in settings updates sidebar; password change with wrong current password shows the error; email change shows the message; delete account with the right email ends on `/login` with the deleted message and the old credentials no longer sign in.
- [ ] **Step 6:** Commit `feat(web): usernames and account settings`.

### Task 7: Optimistic updates

**Files:**
- Create: `app/src/lib/optimistic.ts`, `app/src/lib/optimistic.spec.ts`
- Modify: `app/src/lib/components/TaskRow.svelte`, `KanbanBoard.svelte`, `SubgoalCard.svelte`, `GoalStatusSegment.svelte`, `app/src/routes/tasks/+page.svelte` (streak tick), `app/src/routes/vision-board/+page.svelte` (reorder)

**Interfaces:**
- Produces: `optimistic<T>(opts: { key: string; apply: () => void; revert: () => void; call: () => Promise<T>; refresh: () => Promise<void>; onError: (error: unknown) => void }): Promise<void>`. Runs `apply()` synchronously, then `call()`. A per-`key` sequence number decides staleness: only the latest call for a key may `revert`/`onError` (on failure) or `refresh` (on success); outcomes of older calls are ignored. Keys: `task:<id>`, `subgoal:<id>`, `goal-status:<id>`, `vision-order`.
- Component pattern: a local override `$state` (e.g. `pendingDone: boolean | null`) that the view prefers over the prop; `apply` sets it, `revert` clears it, and it clears when fresh props arrive after `refresh`. `refresh` = `invalidateAll`; `onError` = the component's existing error path to `ErrorBanner`.
- Pessimistic paths (drawers, creates, deletes, settings, account) keep `run()` and must disable their submit button with a saving label while pending, where they don't already.

- [ ] **Step 1: Failing tests** (`optimistic.spec.ts`, fake timers/deferred promises):
  - `applies before the call resolves`
  - `success calls refresh once and never revert`
  - `failure reverts and reports the error`
  - `stale failure is ignored`: call 1 (key `task:1`) pending, call 2 starts; call 1 rejects → no `revert`, no `onError`; call 2 resolves → one `refresh`
  - `different keys do not affect each other`
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement helper; convert the six call sites. **Step 4:** `npm run test:unit -- --run && npm run check` → PASS.
- [ ] **Step 5: Manual check** with Chrome DevTools "Slow 4G": checkbox, kanban drag, subgoal tick, goal status, vision reorder move instantly; progress numbers update a moment later; stopping the API server then ticking a task reverts it and shows the unavailable banner.
- [ ] **Step 6:** Commit `feat(web): optimistic updates for direct manipulation`.

### Task 8: End-to-end tests

**Files:**
- Create: `app/e2e/global-setup.ts`, `app/e2e/global-teardown.ts`, `app/e2e/fixtures.ts`, `app/e2e/web.e2e.ts`, `app/.env.e2e.example`
- Modify: `app/playwright.config.ts`, `app/e2e/shell.e2e.ts`, `app/package.json` (`test:e2e`), `app/README.md`

**Interfaces:**
- `.env.e2e` (gitignored): `E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_KEY`, `E2E_PASSWORD`. Must name the same project as `static/config.json` and `server/.env`.
- `global-setup.ts`: creates users `e2e-a-<runId>@example.com` and `e2e-b-<runId>@example.com` via `POST <url>/auth/v1/admin/users` `{ email, password, email_confirm: true }`, writes `{ a: {id,email}, b: {id,email} }` to `e2e/.users.json` (gitignored). `global-teardown.ts` deletes both via the admin API (404 fine) and removes the file.
- `fixtures.ts`: Playwright `test` extended with `signIn(page, who: 'a' | 'b')` that logs in through `/login` and completes `/welcome` with username `e2e_<who>_<runId>` if shown.
- `playwright.config.ts`: `globalSetup`, `globalTeardown`; `webServer` array: API `npm --prefix ../server run dev` (url `http://localhost:3000/api/healthz`, `reuseExistingServer: true`) and existing build + preview on 4173.

- [ ] **Step 1:** Write `web.e2e.ts`: A signs in, picks username, creates goal `E2E goal` and task `E2E task`, ticks the task (checkbox checked immediately), uploads a small PNG on the vision board and sees it; B signs in in a new context and sees neither the goal, the task nor an image; A deletes the account from settings, lands on `/login` with `Your account was deleted.`, and signing in again as A fails.
- [ ] **Step 2:** Update `shell.e2e.ts`: drop the "missing backend" test; other tests sign in as B first via the fixture; fix assertions that no longer match the current UI.
- [ ] **Step 3:** With `server` `db:up` + `migrate` done and env files filled: `npm run test:e2e` → PASS. If it cannot run (no credentials), say so in the task report rather than marking it done.
- [ ] **Step 4:** README: E2E prerequisites and command. Commit `test(web): two-user end-to-end flow`.

---

## Self-review notes

- Spec coverage: cutover §1 (Tasks 3-4), optimistic + loading §2 (Task 7, progress bar Task 5), auth §3 (Task 5), usernames/account §4 (Tasks 1, 2, 6), testing/dev §5 (all tasks, Task 8), builder's calls (tag Task 4 Step 0, release.yml Task 4, tombstone Task 2, PKCE Task 5, client-only username gate Task 5, config gitignore Task 3).
- Names defined once: `request`, `configureHttp`, `loadConfig`, `AppConfig`, `AppError`, `Profile`, `USERNAME_PATTERN`, `VisionItemView`, `uploadImage`, `getProfile`, `setUsername`, `deleteAccount`, `initAuth`, `auth`, `getAccessToken`, `safeNext`, `isPublicRoute`, `changeEmail`, `changePassword`, `optimistic`, `AuthAdmin`, `removeAllFor`, `deleteAllRows`.
- Order matters: Task 4 needs Task 1's `Profile` type and Task 2's `DELETE /api/account`; Task 6 adds the `/welcome` redirect so Task 5 never points at a missing route.
