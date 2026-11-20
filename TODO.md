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
- [x] Dev deps patched within their majors for new advisories: vite 8.3.8
      (Windows dev-server file exposure, launch-editor), vitest 4.1.12,
      SvelteKit 2.70.4, adapter-static 3.0.11. CI's `--omit=dev` audit: 0
- [ ] SvelteKit 3: the remaining high advisory (GHSA-3r8g, remote-function
      `form` DoS) has no 2.x fix. Not reachable here (static SPA, no server,
      no form actions or remote functions), so it waits for a planned major
- Local npm 9.2 crashes on this lockfile (arborist `edgesOut`); use the npm 11
  that ships with Node 24 (`npx npm@11 ...`). After any install, check the
  `mushpoint-design` `resolved` URL is still `git+https` (npm rewrites it to
  `git+ssh`, which CI cannot fetch)

### 2. API hardening

- [x] Request validation with `zod` schemas at each route boundary
      (`server/src/schemas.ts`; `c.body(schema)` / `c.query(schema)`): shape
      only, 400 names the field; meaning rules stay in the repo layer. Found
      and fixed: `POST /ideas/:id/promote` skipped the own-upload check on
      `motivationImagePath`
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
- [x] OpenAPI 3.1 spec (`server/openapi.json`, `npm run openapi`), request
      bodies and queries generated from the zod schemas. `openapi.spec.ts`
      fails when the file is stale or a listed route is not mounted
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
- [x] ZAP fails the build on any Low+ alert except the two accepted risks,
      matched by alert reference (`10055-6`, `90004-2`) so other CSP findings
      still fail. Local run on the web image: only those two
- [ ] OWASP ZAP full + API scan against staging, authenticated with a bearer token
- [x] `npm audit --audit-level=high` in CI (`ci.yml`)
- [x] Secret scanning (`gitleaks`) in CI over full history. One historical
      finding: a localhost-only Impeccable live-server token in
      `.impeccable/live/server.json` (removed in `10e7dcf`, now gitignored),
      allowlisted by fingerprint in `.gitleaksignore`
- [x] gitleaks as a pre-commit hook (`.githooks/pre-commit`, staged changes
      only; local gitleaks or the CI image via Docker). Enable per clone with
      `git config core.hooksPath .githooks`
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
- [x] Lighthouse CI accessibility score as a secondary signal: `lighthouse`
      CI job over the signed-out pages (`app/lighthouserc.cjs`); accessibility
      must score 100 (all three do), best practices warns below 90 (now 96).
      Signed-in pages stay covered by the axe suite only
- [ ] Keyboard-only pass of every flow
- [x] Drag-and-drop alternatives (2.5.7): kanban already had a move menu
      and left/right buttons per card; calendar chips open the task drawer
      (due date). Vision board had none: added Move earlier / Move later
      buttons that keep focus and announce the new position (`$lib/reorder.ts`)
- [x] Calendar: one tab stop with arrow/Home/End/PageUp/PageDown grid keys
      (`dayKeyTarget`), turns the month at the edges, full-date labels,
      `aria-current="date"`. Gantt: not interactive, so no keys; each bar has a
      text label and done/overdue is shown in words, not only colour (1.4.1).
      Checked in Chromium with a throwaway harness route
- [x] `mushpoint-design` DatePicker follows the ARIA date picker dialog
      (focus in a real grid, full-date labels, live month heading, modal Tab
      trap, Escape back to the trigger, value in the trigger's description);
      Select follows the select-only combobox (Home/End, Page keys, type-ahead,
      Tab selects, labelled groups, per-instance ids). axe with both popups open,
      both themes: found and fixed 3 contrast bugs (other-month days at
      `text-muted/50`, a class clash on the selected day, coquette
      `--mp-text-muted` 4.42:1 on `surface-raised`, now `#ae4f67`).
      Shipped: mushpoint-design `c33390f` + `75642dc`, app pinned to `75642dc`
- [x] a11y e2e scans the task drawer with the DatePicker and Select popups
      open, both themes, and checks Escape closes only the picker (written,
      not yet run: needs the CI e2e secrets)
- [ ] Screen reader pass: NVDA + Firefox, VoiceOver on iOS
- [x] Fixed the 3 svelte-check a11y warnings: cards are `<article>`s,
      calendar days are labelled `role="group"`. svelte-check: 0 warnings
- [x] Focus not obscured (2.4.11): the only overlay is the fixed mobile tab
      bar; the scroll container's `scroll-padding-bottom` clears it. Focus
      rings still to check by eye in the keyboard-only pass
- [x] Target size (2.5.8): axe `target-size` passes on all scanned screens
      in CI; `.mp-hit` now grows icon buttons to 24px everywhere (40px on touch)
- [x] `prefers-reduced-motion`: theme tokens and JS transitions were already
      handled; a global rule in `layout.css` now also stops Tailwind
      `duration-*`, `animate-pulse` and the theme-switch slide
- [x] 200% zoom and 320 px reflow: `app/e2e/reflow.e2e.ts` checks 320 and
      640 px (400% and 200% of 1280) on every screen for sideways page scroll.
      Public screens pass locally; signed-in screens first run in CI
- [x] Form errors announced: banners and the modal save error are
      `role="alert"`; field errors are linked by `aria-describedby` and focus
      moves to the invalid field on submit (all 5 drawers)
- [x] Streak heatmap text alternative: accessible name summarises it
      ("Last 14 days: 9 done, 3 missed. Today: not yet.")

### 6. Testing coverage

- [x] Playwright: Firefox and WebKit projects run `shell.e2e` (`web.e2e`
      deletes user A, so it stays Chromium-only). First run is in CI
- [ ] Visual regression screenshots per theme
- [x] Edge cases: DST and timezone changes around streaks, grace-period
      boundaries (`server/src/logic/streakEdges.spec.ts`, 31 cases, all pass)
- [ ] Signed image URLs expiring on a long-open tab: `Avatar` falls back to
      the initial, `VisionImage` shows a broken image. Refetch on error?
- [x] k6 script (`server/load/dashboard.k6.js`): dashboard reads (6 in
      parallel) and habit ticks, SLO thresholds p95 < 300 ms, errors < 1%
- [ ] Run it against staging (raise `RATE_LIMIT_PER_IP` for the run) and size
      the pg pool (`max: 10` in `server/src/db/pool.ts`) to match
- [x] Postman: Create collection user can try all possible use cases:
      `server/postman/mushpoint.postman_collection.json`, generated from
      `src/postman.ts` (`npm run postman`). Signs in with Supabase, then runs
      every operation except DELETE /account in order, ids passed through
      collection variables; `postman.spec.ts` runs the same steps against the
      API and fails when a route has no step

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
- [x] Data export for users (UK GDPR Articles 15 and 20); deletion already exists:
      `GET /api/account/export` returns every row of every `USER_TABLES` table
      plus 24-hour signed image links; Settings → Your data → Download my data
      saves it as JSON with the sign-in email added. Covered by
      `routes/export.spec.ts` and a step in `web.e2e.ts`. The privacy policy
      should say how to ask for a copy and that this button exists
- [ ] Disclose Supabase session storage

### 11. Docs

- [ ] API + Supabase vs just Supabase
- [ ] Self-hosted Postgres vs Supabase hosted Postgres
- [ ] CI/CD Pipeline
- [ ] K8s Cluster

### 12. File Organization

- [x] App API client: one module per resource in `app/src/lib/api/`
      (categories, goals, subgoals, tasks, streaks, ideas, visionItems),
      re-exported from `index.ts`; `$lib/api` imports unchanged
- [x] Components grouped into `ui/`, `shell/` and one folder per feature
      (`dashboard`, `goals`, `tasks`, `streaks`, `ideas`, `vision`, `account`)
- [x] Import errors in the editor: `prepare` ran `playwright install` before
      `svelte-kit sync`, so a failed browser download skipped sync and left
      `$lib`/`./$types` unresolved. Sync now runs first; README says how to recover
- [ ] Server `repo/`: already one file + spec per resource (11 pairs). Left
      as is; say what layout you want if it still feels messy


### 13. Web performance

A Lighthouse run flagged 4.7 MB of unminified JS and a 6.9 MB payload, but the
whole build (`build/_app/immutable`) is about 1.2 MB, so that run was against
`vite dev`. Re-measure on the production build before fixing anything.

- [x] Baseline on the production build: performance 0.72 on `/login` and
      `/signup` (FCP 3.0 s, LCP 6.5 s). No minify problem; the real costs were
      the icon, no compression, and supabase-js. After the fixes below, on the
      nginx image: 0.94 (FCP 2.2 s, LCP 2.7 s), 238 KB transferred
- [x] `@supabase/auth-js` instead of `supabase-js` (only auth is used): the
      largest chunk on every page went from 220 KB to 103 KB. Same storage key,
      so existing sessions stay signed in
- [x] Mascot icon: 1024 px PNG (433 KB) replaced by a 192 px WebP (5 KB) with
      `width`/`height` on every `<img>`; static 32 px favicon and 180 px
      apple-touch-icon in `app.html`. Original kept in `app/docs/brand/`
- [x] Removed the unused `app/static/mush_img.png` (4.6 MB, shipped in the image)
- [x] `VisionImage.svelte`: `loading="lazy"`, `decoding="async"`; `Avatar.svelte`: `decoding="async"`
- [ ] Resize Supabase uploads server-side (e.g. `sharp`, WebP, ~1600 px vision,
      256 px avatar); or Supabase image transforms (paid plan). Separate PR
- [x] gzip: adapter-static `precompress`, nginx `gzip_static` plus on-the-fly
      fallback. `config.json` excluded (a build-time `.gz` would hide the mounted file)
- [x] Preload the two woff2 fonts (`src/hooks.server.ts`, runs at build) and
      `/config.json` (`app.html`); fonts already use `font-display: swap`
- [x] Forced reflow: the one on load is Svelte's transition code, not the app.
      `CalendarView.svelte` reads layout only on click, read before write. No change
- [x] Lighthouse CI (`app/lighthouserc.cjs`): performance warns below 0.9;
      page weight over 500 KB or images over 50 KB fail the build. sirv now
      serves the `.gz` files like nginx
- Lighthouse locally: run it with Playwright's Chromium (`CHROME_PATH`); on
  Windows it sometimes fails every run with `NO_FCP`, even on builds that passed before
- Not worth chasing: "Minify CSS" (2 KB), one non-composited animation,
  third parties (Supabase)

### 14. AI Usage

- [x] Graphify graph (`graphify-out/`, refreshed with `graphify update .`)
- [ ] Graphify hook setup
- [x] claude.md (`CLAUDE.md`: layout, commands, rules that are easy to break)
