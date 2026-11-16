# How sign-in and data access work in Mushpoint

Mushpoint splits sign-in from data access. The browser signs in with Supabase and receives an access token. The Mushpoint API checks that token on every request, then runs each query inside a database transaction that can only see the signed-in user's rows. This page explains each step in the diagrams in [`app/README.md`](../app/README.md#how-sign-in-reaches-the-api), in the order a request meets them.

## Email links and the PKCE callback

Every email Supabase sends lands on one page, `/auth/callback`, which turns the link into a signed-in session.

Supabase sends 3 kinds of email link:

- **Sign-up confirmation**: sent by `signUp()` and `resendConfirmation()`, with `type=signup`
- **Password reset**: sent by **Forgot password**, with `type=recovery`
- **Email change**: sent to both the old and new address by `changeEmail()`, with `type=email_change`

Each link carries a one-time `code`. The callback page calls `completeCallback()` in `app/src/lib/auth/session.svelte.ts`, which exchanges that code for a session with `exchangeCodeForSession()`. Then it routes on `type`:

- **`signup`**: goes to `/`, where the route guard sends a new user to `/welcome` to pick a username
- **`recovery`**: shows a **Choose a new password** form, then goes to `/`
- **`email_change`**: goes to `/settings`

The client uses the Proof Key for Code Exchange (PKCE) flow. When the browser asks Supabase to send a link, it stores a secret verifier in localStorage. The exchange only succeeds when the same browser presents that verifier with the code. A link opened in a different browser, or on a different device, fails with an error. That's the point of PKCE: someone who intercepts the email alone can't use the link.

The Supabase client is created with `detectSessionInUrl: false`, so it never reads codes from the URL by itself. Only the callback page does, which keeps every code exchange in one place.

## Getting and refreshing the access token

Before every API request, the browser asks `getAccessToken()` for a token, and refreshes it first when it has expired.

After sign-in, Supabase stores a session in localStorage. It holds 2 tokens:

- **Access token**: a short-lived JSON Web Token (JWT) the API accepts as proof of who you are
- **Refresh token**: a long-lived token that buys a new access token from Supabase

`getAccessToken()` calls Supabase's `auth.getSession()`. That reads the stored session without a network call. When the access token has expired or is about to, Supabase calls its token endpoint with the refresh token and stores the new pair. Parallel callers share one refresh, so 6 requests at once still cost 1 refresh call.

The function returns `null` in 2 cases:

- **No stored session**: you never signed in, or you signed out
- **Refresh failed**: Supabase revoked the refresh token, for example after a global sign-out

`request()` in `app/src/lib/api/http.ts` treats `null` as signed out. It throws “Your session has expired. Please sign in again.” without sending anything, because every API route needs a token and the request would only come back 401.

The browser can only check that a token exists and hasn't expired. It can't prove the token is genuine. The API does that.

## Verifying the token on the server

The API accepts a request only when its token is signed by your Supabase project, issued for signed-in users, and names a valid user id.

`createVerifier()` in `server/src/auth.ts` reads the `Authorization: Bearer` header and checks the token with the `jose` library:

- **Signature**: checked against the project's public keys, the JSON Web Key Set (JWKS) at `<supabase_url>/auth/v1/.well-known/jwks.json`. `jose` fetches the set once and caches it.
- **Algorithm**: only `ES256` or `RS256`. A project still on Supabase's legacy shared secret (`HS256`) fails closed, and every request returns 401.
- **Issuer**: must be `<supabase_url>/auth/v1`
- **Audience**: must be `authenticated`, the audience Supabase gives signed-in users
- **Subject**: the `sub` claim must be a UUID. It becomes the request's user id.

Because only public keys are needed, the API never holds a secret that could mint tokens. Any failure answers 401 with `invalid or expired token`, or `missing bearer token` when the header is absent.

The client never sends a user id. The API takes it from the verified token, so a request can't ask for someone else's data.

## Scoping queries with row-level security

Each request runs in one database transaction that Postgres limits to the signed-in user's rows, so a query with a missing filter still can't read another user's data.

`withUser()` in `server/src/db/scope.ts` wraps every route:

```typescript
await client.query("BEGIN");
await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
const result = await fn(driver);
await client.query("COMMIT");
```

The `set_config` call stores the user id for this transaction only. The final `true` means it resets at `COMMIT`, so a pooled connection never carries one user's id into the next request.

Every user table has a row-level security (RLS) policy built on that setting:

```sql
CREATE POLICY own_rows ON goals TO mushpoint_app
  USING (user_id = current_setting('app.user_id')::uuid);
```

The policy applies to 3 things:

- **Reads**: `SELECT` returns only your rows
- **Changes**: `UPDATE` and `DELETE` touch only your rows
- **Inserts**: `user_id` defaults to `current_setting('app.user_id')`, so new rows belong to you without the query naming you

The repository code has no `WHERE user_id = …` clauses. Forgetting one can't leak data, because Postgres adds the filter itself.

3 settings keep this airtight:

- **`mushpoint_app` role**: the API connects as this role, created `NOBYPASSRLS`. It's never the owner or a Supabase service role, both of which skip RLS.
- **`FORCE ROW LEVEL SECURITY`**: applies the policies even to the table owner
- **No access for `anon` and `authenticated`**: migrations revoke Supabase's default grants, so Supabase's auto-generated data API can't read the tables

## Deleting an account

Deleting an account removes the user's images, rows, and login, in an order that stays safe if any step fails partway.

`DELETE /api/account` in `server/src/routes/account.ts` runs 4 steps:

1. **Record a tombstone**: insert the user id into `deleted_users`
2. **Remove images**: delete every object under `<user_id>/` in the Storage bucket, in batches of 1,000
3. **Remove rows**: delete the user's rows from every table in `USER_TABLES`, inside `withUser()`
4. **Remove the login**: call Supabase's Auth admin API to delete the user. A login that's already gone counts as done.

The tombstone comes first because access tokens stay valid until they expire. Every signed-in route except `DELETE /api/account` checks `deleted_users` and answers 401 `account deleted` for a tombstoned user. Without that check, a request arriving mid-deletion could recreate rows, such as default categories, for an account that's going away.

`DELETE /api/account` skips the tombstone check on purpose. Each step is idempotent, so a deletion that failed partway can be retried with the same token. When Storage or Auth is down, the route answers 503 `unavailable`.

The browser finishes a half-done deletion by itself. When the route guard loads your profile and gets 401 `account deleted`, it calls `finishDeletion()` in `app/src/routes/+layout.ts`:

1. Retries `DELETE /api/account`
2. Signs you out
3. Redirects to `/login?deleted=1`, which shows “Your account was deleted.”

If the retry fails again, it redirects to `/login?deleted=pending` instead, which shows “We couldn't finish deleting your account. Sign in again to retry.” The next sign-in runs the same retry.

A test in `server/src/repo/account.spec.ts` fails if any table with a `user_id` column is missing from `USER_TABLES`, so a new table can't be forgotten by account deletion.

## Handling a 401 in the browser

2 pieces of code react to a 401, and `app/src/routes/+layout.ts` keeps them from colliding.

### The route guard

The root layout load runs on every navigation. It's the main place that decides whether you can see a page:

1. Loads `config.json` once and sets up Supabase and the HTTP client
2. Calls `getAccessToken()`. Without a token, it redirects to `/login?next=<path>`, unless the page is public.
3. Loads your profile with `GET /api/profile`
4. On a 401, it signs you out and redirects to `/login?next=<path>`, or runs `finishDeletion()` for `account deleted`
5. Without a username, it redirects to `/welcome`

Public pages are `/login`, `/signup`, `/forgot-password`, and `/auth/callback`.

### The 401 callback

The guard only runs on navigation. A token can also be refused between navigations, for example when you click a checkbox after your session was revoked. For that case, `request()` calls `onUnauthenticated()` whenever the API answers 401. That function signs you out and navigates to `/login?next=<path>`.

`onUnauthenticated()` only fires for a 401 from the API. Having no token at all is the guard's job, so `request()` throws without calling it.

### Why the guard needs `loading` and `redirecting`

When the guard's own profile request gets a 401, `request()` calls `onUnauthenticated()` and also throws to the guard. Both would then sign out and navigate. 2 flags prevent that:

- **`loading`**: counts guard loads in flight. While it's above 0, `onUnauthenticated()` does nothing, and the guard handles the 401 itself. This matters most for `account deleted`: an early sign-out would drop the token before `finishDeletion()` could retry the deletion.
- **`redirecting`**: set while one sign-out and redirect is running. When 6 parallel requests all get a 401, only the first one acts.

A shorter design, where `onUnauthenticated()` calls SvelteKit's `invalidateAll()` to rerun the guard, doesn't work. The rerun guard's profile request gets a 401 too. That calls `onUnauthenticated()` again, which cancels the guard's in-flight redirect and starts another rerun, until the sign-out happens to finish first.

### Page loads run alongside the guard

SvelteKit starts each page's load at the same time as the guard, unless the page load calls `await parent()`. None do, so signed-in pages fetch their data and profile in parallel. When you're signed out, each page load's requests fail inside `request()` before any network call, and the guard's redirect to `/login` wins.
