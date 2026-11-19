# Todos

## Production readiness

Ordered roughly by risk. Suggested sequence: CI, then security hardening, then
accessibility, then ops.

### Done

- [x] API: reject non-http(s) `repoUrl` server-side (stored XSS via `javascript:` link)
- [x] API: goal `motivationImagePath` must be one of the caller's own uploads
- [x] API: cap every user text field at 10,000 characters (`MAX_TEXT`)
- [x] API: security headers on every response (`nosniff`, `DENY` framing,
      `no-referrer`, `default-src 'none'` CSP, `no-store`)

### 1. CI (release blocker)

- [x] GitHub Actions (`.github/workflows/ci.yml`) on every PR and push to
      `main`: server typecheck/tests/build against a Postgres 16 service,
      app check/lint/unit tests/build, `npm audit --audit-level=high`
- [x] Playwright e2e job runs in CI against a separate test Supabase project
      (secrets `E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_KEY` (`sb_secret_`),
      `E2E_SUPABASE_ANON_KEY` (`sb_publishable_`), `E2E_PASSWORD`; private
      `vision` bucket). 53/53 green, including axe on all signed-in screens.
      First run needed an explicit `baseURL` (two webServers).
- [ ] Branch protection on `main`: green CI required to merge (GitHub settings, manual)
- [x] Dependabot (`.github/dependabot.yml`): npm for `app/` and `server/`,
      Docker base image, GitHub Actions, weekly
- [x] Prettier `endOfLine: auto` so `npm run lint` passes on Windows CRLF
      checkouts; reformatted 12 files that had real drift
- [x] Bumped `devalue` 5.9.0 to 5.9.4 (high-severity advisories, via SvelteKit)

### 2. API hardening

- [ ] Request validation with `zod` schemas at each route boundary
      (`c.body<T>()` is only a type cast today)
- [x] Rate limiting in-process (`express-rate-limit`, `server/src/rateLimit.ts`):
      600 requests/min per IP on `/api` (health probes exempt; `/readyz`
      has its own 120/min per IP because it queries the DB, flagged by CodeQL), 30 image
      uploads per 15 min per user (vision board + avatar), 5 `DELETE /account`
      per hour per user; 429 with `{ kind: 'unavailable' }`
- [x] `TRUST_PROXY` env (proxy hop count) so the per-IP limit sees the real
      client address behind the ingress; set it to 1 when deployed
- [ ] Counters are per process: move to a shared store (Redis) if the API
      runs more than a couple of replicas
- [x] Test flake: `routes.spec.ts` used a fixed `alpha_1` username, so one
      crashed run broke every later run; now unique per run
- [ ] Vitest workers on Windows sometimes die with exit code `0xC0000409`
      (native crash, also happens on code from before this work); CI on Linux is the source of truth
- [ ] Deferred until a k6 run shows it matters: move the `deleted_users`
      tombstone check into the `withUser` transaction. Upload routes don't go
      through `withUser`, so moving it naively would let deleted accounts upload.
- [ ] Deferred until a k6 run shows it matters: run `bootstrapUser` once at
      first login instead of a `SELECT` on every request
- [ ] Account deletion: alert when `authAdmin.deleteUser` fails (needs
      Sentry, see section 7). Already done: the failure is logged, the client
      gets 503, and a retry works because `DELETE /account` skips the tombstone.
- [ ] OpenAPI spec for the API (needed for the ZAP API scan; generate from zod)
- [x] Client: `safeHref` in `app/src/lib/format.ts` renders `repoUrl` as a link
      only when it is http(s), covering rows written before the server check

### 3. Security testing

- [x] IDOR sweep (`server/src/routes/idor.spec.ts`): user B aims all 23
      id-taking routes and parent references at user A's records; every one
      404s and A's data stays unchanged. Checked that it fails (17/24) when
      the attacker is the owner. Add a row for every new `:id` route.
- [x] OWASP ZAP baseline in CI (`.github/workflows/security.yml`) against
      the production nginx web image; report uploaded as an artifact.
      Local run: 0 fail, only the accepted risks below remain.
- [ ] Make ZAP fail the build on new warnings (rules file that ignores the
      two accepted risks only)
- [ ] OWASP ZAP full + API scan against staging, authenticated with a bearer token
- [x] `npm audit --audit-level=high` in CI (`ci.yml`)
- [x] Secret scanning (`gitleaks`) in CI over full history. One historical
      finding: a localhost-only Impeccable live-server token in
      `.impeccable/live/server.json` (removed in `10e7dcf`, now gitignored),
      allowlisted by fingerprint in `.gitleaksignore`
- [ ] gitleaks as a pre-commit hook
- [x] Container scan (`trivy`, HIGH/CRITICAL, fixed only) of both images in CI.
      API image: 6 HIGH, all in the npm CLI bundled with `node:24-slim`;
      fixed by removing npm/npx/corepack from the runtime stage. Now 0.
- [x] Web image: the base tag lags Alpine fixes (13 HIGH/CRITICAL in musl,
      zlib, expat, libxslt), so the runtime stage runs `apk upgrade` (then back
      to uid 101). Stable nginx 1.30.6 also had 5 HIGH nginx CVEs with no 1.30.7
      image, so the base is mainline `nginx-unprivileged:1.31-alpine`. Rescan: 0.
- [x] SAST: CodeQL `security-extended` in CI
- [ ] Walk the OWASP ASVS Level 1 checklist against `docs/auth.md`
- [ ] Supabase: auth rate limits, CAPTCHA on sign-up and password reset,
      leaked-password protection, bucket stays private

### 4. Web client security headers

- [x] CSP via SvelteKit `kit.csp` (hash mode, `app/svelte.config.js`): no
      inline scripts allowed, `connect-src`/`img-src` limited to self +
      `*.supabase.co`, `object-src 'none'`
- [x] Production web image (`app/Dockerfile`, `app/nginx/`): non-root
      `nginx-unprivileged:1.31-alpine`, SPA fallback, immutable caching for
      hashed assets, `no-cache` for `index.html`/`config.json`, `config.json`
      mounted per environment. Sends the full CSP as a header (copied from the
      build's meta tag at image build) plus `frame-ancestors 'none'`, HSTS,
      `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
      COOP, CORP
- [x] Checked in headless Chromium: login, signup and redirects load with no
      CSP violations
- [ ] Check signed-in pages under the CSP (vision board images, avatar) once
      the e2e secrets exist; e2e should run against the nginx image
- [ ] A custom Supabase domain must be added to `connect-src`/`img-src`
- Accepted risks: `style-src 'unsafe-inline'` (Svelte writes style attributes
  and transition styles at runtime); no `Cross-Origin-Embedder-Policy`
  (`require-corp` would block Supabase signed images)
- [ ] Verify headers on the deployed domain (securityheaders.com)

### 5. Accessibility (target WCAG 2.2 AA)

- [x] `@axe-core/playwright` spec (`app/e2e/a11y.e2e.ts`): WCAG 2.0 to 2.2
      A/AA rules on 3 public + 8 signed-in screens in both themes (22 tests).
      Runs with the e2e job once the CI secrets exist; it will fail until the
      contrast fixes below land.
- [x] Local axe scan of the public screens (login, signup, forgot password),
      both themes, desktop + mobile: only failures are color contrast, all
      from theme tokens in `mushpoint-design/css/theme.css`
- [x] Contrast fix chosen: keep the pastel accent for fills and add
      `--mp-accent-ink` (`text-accent-ink`) for accent-colored text.
      coquette ink `#c7264e`, button labels `#4a2e33`, muted `#b3516a`;
      nocturne ink `#9c93d3`, button labels `#0b0c1a`. 17 `text-accent`
      uses switched (3 in the design package, 14 in the app). Local axe on
      the public screens: 0 violations, both themes, desktop + mobile.
- [x] Shipped: mushpoint-design `053d50d` (tokens) + `cfb7538` (README on
      which accent token to use), app pinned to `cfb7538`. Axe recheck on the
      installed package: 0 violations on the public screens.
- Original findings, for reference:
  - nocturne `--mp-accent` `#7b6fc4` is 3.59:1 on surface and 4.19:1 under
    `--mp-accent-contrast` text; `#8f85cd` gives 4.69 / 5.47
  - coquette `--mp-text-muted` `#b85c73` is 4.36:1 on white; `#b3516a` gives 4.88
  - coquette `--mp-accent` `#e8879f` is 2.5:1 as text on white and 2.38:1
    under button text; passing needs `#d62b55` (much stronger pink). Or keep
    the pastel for fills and add a darker `--mp-accent-text` token for text
    and buttons.
- [x] First signed-in axe run in CI (16 failures, all color-contrast): five
      `text-muted/50..75` uses faded the tuned token below 4.5:1; now full
      `text-muted`. Also found icon-only buttons with no accessible name: the
      design Tooltip wrapped icons in `role="group"`, which Chromium drops from
      the button name. Fixed in mushpoint-design `c4d5938`, `Icon.spec.ts` guards it.
- [x] Vision board upload in CI e2e: the test project had no `vision`
      bucket; the test now reports the dialog's error if an upload fails
- [ ] Lighthouse CI accessibility score as a secondary signal
- [ ] Keyboard-only pass of every flow
- [ ] Kanban: keyboard alternative to drag-and-drop (2.5.7)
- [ ] Gantt timeline and calendar: keyboard navigation, screen reader labels
- [ ] `mushpoint-design` DatePicker and Select follow ARIA combobox/grid patterns
- [ ] Screen reader pass: NVDA + Firefox, VoiceOver on iOS
- [ ] Fix the 3 svelte-check a11y warnings: drag handlers on `<div>`s with
      no role in `CalendarView.svelte:278`, `KanbanBoard.svelte:347`,
      `VisionBoard.svelte:75`. They go with the keyboard alternatives below.
- [ ] Focus visible and not obscured by sticky headers (2.4.11)
- [ ] Target size at least 24x24 px (2.5.8)
- [ ] `prefers-reduced-motion` respected
- [ ] 200% zoom and 320 px reflow without loss
- [ ] Form errors announced (`aria-live` / `aria-describedby`)
- [ ] Streak heatmap has a text alternative

### 6. Testing coverage

- [ ] Playwright: add Firefox and WebKit projects
- [ ] Visual regression screenshots per theme
- [ ] Edge cases: DST and timezone changes around streaks, grace-period
      boundaries, signed image URLs expiring on a long-open tab
- [ ] k6 load test on dashboard and streak endpoints; set an SLO
      (e.g. p95 under 300 ms) and size the pg pool to match

### 7. Observability

- [x] Structured JSON logging (`pino`, `server/src/logger.ts`): one line per
      request (method, path without query, status, duration, user id,
      request id); 5xx at error level; `X-Request-Id` kept when the ingress
      sends a safe one, else a new UUID, and echoed on the response. Headers
      and query strings are never logged; auth headers redacted as a backstop.
      All `console.*` in the API replaced. `LOG_LEVEL` env, silent under tests.
- [ ] Error tracking (Sentry) for API and SPA
- [ ] Uptime check on `/api/readyz`; alerts on 5xx rate and latency
- [x] Graceful shutdown (`server/src/shutdown.ts`): SIGTERM and SIGINT stop
      new connections, close idle keep-alives, drain, close the pool, exit 0;
      exit 1 after 20 s if requests are stuck (inside Kubernetes' 30 s grace)

### 8. Data safety

- [ ] Supabase Postgres backups and point-in-time recovery enabled
- [ ] Restore drill done and documented
- [ ] Migrations run in CI against a prod-like snapshot; rollback plan per migration

### 9. Deployment and operations

- [ ] Staging environment with its own Supabase project
- [ ] Secrets in a secret manager, never in env files on disk
- [ ] Runbook (`docs/k8s-runbook.md`): deploy, roll back, rotate
      `SUPABASE_SERVICE_KEY`, incident contacts

### 10. Legal and privacy

- [ ] Privacy policy and terms of service
- [ ] Data export for users (GDPR); deletion already exists
- [ ] Disclose Supabase session storage
