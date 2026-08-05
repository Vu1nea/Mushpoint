# Bug Report Site — Design

## Purpose

A public website where anyone can report bugs/issues found in Mush-Track. Reports post to a server and are stored; the developer views and manages them on a password-protected admin page. Optimized for lowest cost and simplest implementation — not part of the Mush-Track Tauri app itself.

## Scope decision

This is a fully separate project from Mush-Track: different runtime (server-rendered web app vs. Tauri desktop app), different deploy target (Vercel vs. Tauri build), no shared code. It lives in its own repo, **`mushtrack-bugs`**, rather than inside the Mush-Track repo. Rationale: Mush-Track's CI (cargo test, Playwright e2e, Tauri build) would otherwise need to explicitly ignore this folder, and its git history/tags would mix with an unrelated project's commits.

## Stack

- **SvelteKit** — frontend + server routes/actions. Reuses the team's existing framework knowledge.
- **Supabase** (free tier) — Postgres DB for report storage, Storage bucket for screenshots.
- **Vercel** (free tier) — hosting/deploy.

Cost: $0 to start on both Supabase and Vercel free tiers.

### Alternatives considered

- **Cloudflare D1 + Cloudflare Pages** — single-vendor, slightly more generous free limits, but introduces unfamiliar D1/Wrangler tooling. Rejected in favor of the more familiar Supabase.
- **Static form + Formspree/Getform (no backend)** — least code, but reports land in a third-party dashboard instead of a custom admin page on this site, which was a hard requirement. Rejected.

## Architecture

```
mushtrack-bugs/
  src/routes/
    +page.svelte          public report form
    +page.server.ts       form action: honeypot check, rate limit, insert row, upload screenshot
    admin/
      +page.svelte        login form (no session) or report list (has session)
      +page.server.ts     load reports (session check); actions: login, logout, resolve, delete
  src/lib/server/
    supabase.ts            Supabase client (service role key, server-only env var)
    rateLimit.ts            in-memory per-IP counters
```

No shared code with Mush-Track. Standalone SvelteKit project deployed independently.

## Data model

Supabase Postgres table `reports`:

| column | type |
|---|---|
| id | uuid, pk, default gen_random_uuid() |
| created_at | timestamptz, default now() |
| title | text |
| description | text |
| steps_to_reproduce | text |
| os | text |
| severity | text (`low` / `med` / `high`) |
| screenshot_url | text, nullable |
| resolved | boolean, default false |

Screenshots upload to a Supabase Storage bucket `screenshots` (public-read); the resulting URL is stored in `screenshot_url`.

Fields intentionally excluded from v1: app version, reporter email/contact. Can be added later as nullable columns without breaking existing data.

## Public report flow

1. Reporter fills in: title, description, steps to reproduce, OS, severity. Screenshot upload is optional.
2. A hidden honeypot input is present in the form; if it arrives non-empty, the submission is silently dropped (treated as success to the bot, no DB write).
3. The server action rate-limits by IP — e.g. 5 submissions/hour, tracked via an in-memory counter in `rateLimit.ts`. This resets on redeploy/cold start, which is an accepted tradeoff at this scale (not persisted to DB — see Testing/limits below).
4. On valid submission: screenshot (if present) uploads to the Storage bucket first, then the row inserts with the resulting URL. User sees a "Thanks, report received" confirmation.
5. On failure (network/Supabase error): generic inline error shown, form values preserved so the user doesn't retype everything.

## Admin flow

1. Visiting `/admin` with no valid session cookie shows a password form.
2. Correct password → a random session token is generated, HMAC-signed with a server-only secret, and stored in an httpOnly + secure cookie. No session table in the DB is needed — the server verifies the HMAC on each request instead of doing a DB lookup.
3. Incorrect password → rate-limited (e.g. 5 attempts / 15 min per IP) via the same in-memory limiter, generic "incorrect password" error (no distinction from "rate limited" shown to the client, to avoid leaking state).
4. Valid session → reports list, newest first, filterable by resolved/unresolved, with actions to toggle resolved and delete a report (and its screenshot from Storage).

## Error handling

- Supabase/network failures during submission or admin actions surface a generic user-facing message; no internal error details are leaked to the client.
- Admin mutations (resolve/delete) fail atomically from the UI's perspective — no partial state shown if the underlying action errors.

## Security notes

- Admin password lives only in a Vercel env var, never committed.
- Session cookie holds a signed random token, not the raw password.
- Login attempts and public submissions are both rate-limited by IP using the same in-memory mechanism.
- This auth approach is judged adequate for a single-admin, low-stakes internal tool (bug reports, no payment/PII data beyond what a reporter voluntarily writes into free-text fields). Supabase Auth was considered and deferred — worth revisiting if multiple admins or password-recovery flows are needed later.

## Known limitations (accepted for v1)

- Rate limiting is in-memory and per server instance — resets on redeploy and doesn't share state across multiple serverless instances under high concurrency. Acceptable at expected traffic; revisit with a persisted/edge rate limiter (e.g. Upstash) if abuse becomes a real problem.
- No screenshot moderation — any image uploaded via the form is stored and publicly reachable via its URL if the bucket is public-read. Acceptable given the bucket is not linked from anywhere discoverable and files are namespaced by report id.

## Testing

- Vitest unit tests for: honeypot rejection logic, rate-limit counter behavior, and the admin session token HMAC verification (valid, tampered, expired).
- No Playwright/e2e suite in v1 — surface area is small enough to verify manually (submit a report, check it appears in admin, resolve/delete it).
