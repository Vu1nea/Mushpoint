# OWASP ASVS 4.0.3 Level 1 walk

A pass over the Level 1 requirements against the code and [`auth.md`](../auth.md), done
2026-11-20 from the repository, not by testing a deployment. Each line names the evidence. Items
Mushpoint does not have (no server-side sessions or cookies, no XML, no deserialization, no
outbound requests from user input, no file downloads by name) are grouped under "Not applicable"
rather than listed one by one.

Status: **Pass**, **Gap** (something to change), **Supabase** (a setting in the Supabase
dashboard, not code; check it there), **Deploy** (depends on the deployed environment).

## Gaps to act on

| # | Requirement | Finding | Fix |
| --- | --- | --- | --- |
| 2.1.1 | Passwords at least 12 characters | Sign-up and change-password forms accept 8 (`MIN_PASSWORD = 8` in `app/src/routes/signup/+page.svelte` and `AccountSettings.svelte`). Supabase's minimum is the real check. | Set the Supabase minimum password length to 12, then raise both `MIN_PASSWORD` constants to match. Existing passwords keep working. |
| 2.1.7 | Passwords checked against breached sets | Off unless Supabase leaked-password protection is on. | Turn it on (also in `TODO.md`, section 3). |
| 2.2.1 | Anti-automation on sign-in, sign-up, reset | The API limits per IP, but those three calls go straight to Supabase Auth. | Supabase auth rate limits and CAPTCHA on sign-up and reset (`TODO.md`, section 3). |
| 3.3.1 | Logout invalidates the session | Sign-out revokes the refresh token, but an issued access token stays valid until it expires (Supabase default 1 hour). Account deletion is covered by the tombstone check. | Accept and document, or shorten the JWT expiry in Supabase (for example 15 minutes; refresh is automatic). |
| 7.1.x / 7.2.x | Log auth events | Request logs carry user id and status, so 401s are visible, but sign-in successes and failures happen in Supabase and are only in its auth logs. | Note in the runbook where Supabase auth logs are. No code change needed. |

## By chapter

### V1 Architecture

| Req | Status | Evidence |
| --- | --- | --- |
| 1.x (L1 items) | Pass | Trust boundaries in the README architecture diagram; one API is the only path to data; decisions in [`decisions.md`](../decisions.md). |

### V2 Authentication (Supabase Auth)

| Req | Status | Evidence |
| --- | --- | --- |
| 2.1.1 | Gap | See above. |
| 2.1.2, 2.1.3 | Supabase | Max length at least 64 and no truncation: Supabase allows up to 72 bytes (bcrypt). |
| 2.1.4, 2.1.9 | Pass | No composition rules in the app; any Unicode accepted. |
| 2.1.5, 2.1.6 | Pass | Users can change their password; change requires the current one (`changePassword` re-verifies it in `session.svelte.ts`). |
| 2.1.7 | Gap | See above. |
| 2.1.8 | Pass | Not required at L1 beyond what exists. |
| 2.1.10 | Pass | No forced rotation. |
| 2.1.11, 2.1.12 | Pass | `PasswordInput` allows paste and has a show-password toggle. |
| 2.2.1 | Gap | See above. |
| 2.2.2 | Pass | No weak authenticators (no SMS, no security questions). |
| 2.2.3 | Supabase | Notification after password or email change: Supabase sends email-change confirmations to both addresses; check password-change notification is on. |
| 2.3.1 | Pass | No system-generated initial passwords. |
| 2.5.1 to 2.5.4 | Pass | Reset is by emailed link only, through the PKCE callback (`/auth/callback`); no hints or secret questions; no shared or default accounts. |
| 2.5.6 | Supabase | Reset link lifetime and single use are Supabase settings. |
| 2.7.x, 2.8.x | Not applicable | No out-of-band codes or one-time passwords. |

### V3 Session management

| Req | Status | Evidence |
| --- | --- | --- |
| 3.1.1 | Pass | Tokens travel in the `Authorization` header, never the URL. The PKCE `code` in the callback URL is single use and exchanged immediately. |
| 3.2.1 | Pass | Supabase issues a new session on every sign-in. |
| 3.2.2 | Pass | Tokens are Supabase JWTs. |
| 3.2.3 | Pass | Stored in `localStorage` by `@supabase/auth-js`, not in a cookie, so the cookie flags in 3.4 do not apply. The CSP (`script-src 'self'` plus a hash) is what protects it from injected script. |
| 3.3.1 | Gap | See above. |
| 3.4.x | Not applicable | No cookies. |
| 3.7.1 | Pass | Email change and password change re-authenticate (password re-check; email change confirmed from both inboxes). |

### V4 Access control

| Req | Status | Evidence |
| --- | --- | --- |
| 4.1.1, 4.1.2 | Pass | Enforced in the API and in Postgres, never the client: RLS on every table, role `mushpoint_app` with `NOBYPASSRLS` (`server/src/db/scope.ts`). |
| 4.1.3 | Pass | Least privilege: the API role has no DDL; migrations run as the owner in a separate Job. |
| 4.1.5 | Pass | Errors fail closed: no token, a bad token or a deleted user is a 401 before any query. |
| 4.2.1 | Pass | IDOR: another user's id answers 404; `server/src/routes/idor.spec.ts` sweeps all 23 id-taking routes. Image paths must be the caller's own (`isOwnImagePath`). |
| 4.2.2 | Pass | No cookies, so no cross-site request forgery: the token is sent only by the app's own code. |
| 4.3.1 | Not applicable | No admin interface. |
| 4.3.2 | Pass | No directory listing (nginx default `autoindex off`); no `.git` or source maps in the web image beyond the built bundle. |

### V5 Validation, sanitization and encoding

| Req | Status | Evidence |
| --- | --- | --- |
| 5.1.1 | Pass | No HTTP parameter pollution: query and body read only through zod schemas (`c.query`, `c.body`). |
| 5.1.3, 5.1.4 | Pass | Allow-list validation with zod at every route; meaning checks (trim, `MAX_TEXT`, enums) in `server/src/repo/`. |
| 5.1.5 | Pass | No redirects to user-supplied URLs; callback redirects go to fixed app paths. |
| 5.2.1, 5.3.3 | Pass | Svelte escapes output by default. The one `{@html}` renders app-owned icon markup (`Icon.svelte`), never user input. |
| 5.2.6 | Pass | No server-side requests to user-supplied URLs (`repoUrl` is stored and shown, never fetched). |
| 5.3.x URL safety | Pass | `repoUrl` must be http(s) on the server, and `safeHref` renders it as a link only when it is. |
| 5.3.4 | Pass | Parameterised SQL throughout the repo layer. |
| 5.3.8 | Pass | No OS command execution. |
| 5.5.x | Not applicable | No deserialization of untrusted objects; JSON only, 1 MB body limit. |

### V7 Errors and logging

| Req | Status | Evidence |
| --- | --- | --- |
| 7.1.1, 7.1.2 | Pass | Never logs tokens, headers or query strings (`server/src/logger.ts`, auth headers redacted as a backstop). |
| 7.4.1 | Pass | Database and internal errors answer a generic `internal error` with the request id in the response header; details only in the server log (`http.ts`). |

### V8 Data protection

| Req | Status | Evidence |
| --- | --- | --- |
| 8.2.1 | Pass | API responses send `Cache-Control: no-store`. |
| 8.2.2 | Pass | Browser storage holds only the Supabase session and display preferences (see the privacy policy draft). |
| 8.3.1 | Pass | Tokens in headers, never in URLs. Signed image URLs carry a short-lived token by design. |
| 8.3.2 | Pass | Users can export (`GET /api/account/export`) and delete everything. |

### V9 Communications

| Req | Status | Evidence |
| --- | --- | --- |
| 9.1.1 | Deploy | TLS terminates at the ingress; HSTS is already sent by the web server. Confirm HTTPS-only on the real domain (`TODO.md`, section 4). |
| 9.1.2, 9.1.3 | Deploy | TLS versions and ciphers are the ingress or load balancer's configuration. |

### V10 Malicious code

| Req | Status | Evidence |
| --- | --- | --- |
| 10.3.2 | Pass | No auto-update or remote code loading; CSP limits scripts to the app's own origin. Dependencies pinned by lockfile, audited in CI, updated by Dependabot. |

### V11 Business logic

| Req | Status | Evidence |
| --- | --- | --- |
| 11.1.1 | Pass | Steps are validated server-side (for example, promoting an idea creates the goal in one transaction). |
| 11.1.2 to 11.1.4 | Pass | Rate limits per IP and per user, tighter on uploads (30 per 15 min) and account deletion (5 per hour). |

### V12 Files and resources

| Req | Status | Evidence |
| --- | --- | --- |
| 12.1.1 | Pass | Uploads capped at 5 MB in multer before the bytes are read further; one file per request. |
| 12.3.1 to 12.3.6 | Pass | No user-supplied file names or paths: the server picks the storage path; type is judged by magic bytes and must match the declared type (`server/src/images.ts`). |
| 12.4.1 | Pass | Files live in a private Supabase bucket, served only through signed URLs, never from the web server. |
| 12.5.1 | Pass | The web server serves only the built SPA (an allow-listed set of static files). |
| 12.6.1 | Pass | No server-side fetching of URLs. |

### V13 API

| Req | Status | Evidence |
| --- | --- | --- |
| 13.1.1 | Pass | One encoding (UTF-8 JSON) and one parser. |
| 13.1.3 | Pass | No keys or tokens in URLs. |
| 13.2.1 | Pass | Only the methods each route defines; others answer 404. |
| 13.2.2 | Pass | Request bodies validated against zod schemas; OpenAPI generated from them. |
| 13.2.3 | Pass | Not applicable to bearer-token APIs (no cookie-based CSRF). |

### V14 Configuration

| Req | Status | Evidence |
| --- | --- | --- |
| 14.2.1 | Pass | Dependencies audited (`npm audit` in CI), scanned (trivy), updated weekly (Dependabot). |
| 14.3.2 | Pass | No debug modes or stack traces in production responses; `x-powered-by` disabled; nginx `server_tokens off`. |
| 14.3.3 | Pass | No version headers. |
| 14.4.1 to 14.4.7 | Pass | API: `nosniff`, `DENY` framing, `no-referrer`, `default-src 'none'` CSP. Web: hash-based CSP with `frame-ancestors 'none'`, HSTS, COOP, CORP, `Referrer-Policy`, `Permissions-Policy`. Content types always set. |
| 14.5.3 | Pass | No CORS: one origin; the API sends no `Access-Control-Allow-Origin`. |

## Not applicable at Level 1

V6 stored cryptography beyond Supabase (the app does no cryptography of its own), V2.7 and 2.8
(no out-of-band or one-time codes), V3.4 and 3.5 cookie and token-binding items (no cookies),
V5.4 memory safety (TypeScript), V5.5 deserialization, XML and SOAP items in V13.
