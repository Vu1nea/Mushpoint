# CI/CD pipeline

What runs on every change, what blocks a merge, and what deploys. Short version: CI is thorough,
CD does not exist yet. Images are built and scanned in CI but not pushed anywhere, and deploying
is the manual runbook in [`k8s-runbook.md`](k8s-runbook.md).

## Workflows

Two GitHub Actions workflows run on every pull request and every push to `main` or `dev`. Both use
`permissions: contents: read`.

### `ci.yml`: does it build and work

| Job | What it runs | Notes |
| --- | --- | --- |
| Server | `npm ci`, `npm run check` (tsc), `npm test` (Vitest), `npm run build` | Against a `postgres:16` service container, the same as `npm run db:up` locally. Includes the IDOR sweep and the checks that `openapi.json` and the Postman collection are current. |
| App | `npm ci`, `check` (svelte-check), `lint` (Prettier), `test` (Vitest), `build` | |
| Lighthouse | Builds the app, serves it with sirv (`--single --gzip`, like nginx), runs Lighthouse CI on `/login`, `/signup`, `/forgot-password` | Accessibility must be 100. Best practices and performance warn below 0.9. Page weight over 500 KB or images over 50 KB fail. Config: `app/lighthouserc.cjs`. |
| Dependency audit | `npm audit --audit-level=high --omit=dev` in both packages | Production dependencies only. |
| E2E | Playwright: `web.e2e` (two users, data isolation, account deletion), `shell.e2e` (also on Firefox and WebKit), `mobile.e2e` (iPhone and Pixel), `a11y.e2e` (axe, both themes), `reflow.e2e` (320 and 640 px) | Needs a real Supabase test project. Skipped, and green, until the `E2E_*` secrets exist. Runs the API from source and the app from `vite preview`. |

A newer push to the same branch cancels the running CI (`concurrency`).

### `security.yml`: is it safe to ship

Also runs Mondays 06:00 UTC, so new CVEs in unchanged code are caught, and on demand.

| Job | What it runs |
| --- | --- |
| Secret scan | gitleaks over the full history. Known false positives are in `.gitleaksignore` by fingerprint. The same scan runs as a pre-commit hook (`git config core.hooksPath .githooks`). |
| Container scan | Builds both images and runs trivy, failing on fixable HIGH or CRITICAL findings. |
| SAST | CodeQL `security-extended` over the TypeScript. |
| DAST | Starts the production web image and runs the OWASP ZAP baseline. Any Low or higher alert fails, except the two accepted risks matched by alert reference (see `TODO.md`, section 4). |

### Dependabot

Weekly updates for npm in `server/` and `app/` (dev dependencies grouped), both Docker base images,
and the GitHub Actions versions. Each update is a pull request, so it goes through both workflows.

## Secrets

| Secret | Used by |
| --- | --- |
| `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY` | E2E: the app's `config.json` |
| `E2E_SUPABASE_SERVICE_KEY` | E2E: the API, and creating and deleting the test users |
| `E2E_PASSWORD` | E2E: the test users' password |

They belong to a separate test Supabase project, never production. Nothing in CI can reach
production.

## Branch flow

```
feature/* --PR--> dev --PR--> main
```

1. Branch from `dev`, open a PR into `dev`. CI and security run on the PR; merge when green.
2. Every push to `dev` runs both workflows again, including E2E against the test Supabase
   project. `dev` is the test environment: there is no hosted staging.
3. When `dev` is green and you are happy with it, open a PR `dev` -> `main` and merge it
   yourself. That click is the approval. Use a merge commit, not squash, so `dev` and `main`
   keep a shared history.
4. Never push or open a PR straight to `main`, except a hotfix, which is then merged back
   into `dev`.

Dependabot PRs target `dev`.

Branch protection (GitHub setting, manual; `TODO.md`, section 1):

- `dev`: require a PR, require status checks (Server, App, Dependency audit, E2E, Secret
  scan, SAST), no force push.
- `main`: require a PR from `dev`, the same status checks, no force push, no direct push.
  Do not require approving reviews: GitHub does not let you approve your own PR.

## What deploys

Nothing automatically. Today a release is:

1. Merge `dev` to `main` with CI green.
2. Build the two images from that commit (`docker build server`, `docker build app`).
3. Run the migrate Job if the release adds a migration, then roll out the new images, as in
   [`k8s-runbook.md`](k8s-runbook.md).

## Adding CD later

The pieces that are missing, in the order they would go in:

1. **Push images.** On push to `main`, build both images once, tag them with the commit SHA, and
   push to a registry (GitHub Container Registry needs no extra account). Scan that exact image
   with trivy before pushing, instead of rebuilding in `security.yml`.
2. **Staging deploy.** A job, gated on CI and security passing, that runs the migrate Job and
   then `kubectl set image` on staging. Needs a staging cluster and its kubeconfig as a secret,
   ideally through OIDC rather than a long-lived token.
3. **Checks against staging.** The k6 load test (`server/load/dashboard.k6.js`) and the ZAP full
   and API scans (`TODO.md`, section 3) run against staging after each deploy.
4. **Production.** The same job behind a manual approval (a GitHub environment with required
   reviewers), promoting the image already tested on staging rather than rebuilding it.
