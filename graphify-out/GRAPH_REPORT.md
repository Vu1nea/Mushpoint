# Graph Report - Mushpoint  (2026-11-21)

## Corpus Check
- 299 files · ~144,326 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 10, .example 2, .conf 2)

## Summary
- 2275 nodes · 4704 edges · 133 communities (115 shown, 18 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 142 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `80d71527`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- API Route & IDOR Tests
- .execute
- SQL Driver & Test DB
- Security Workflow
- E2E & A11y Tests
- Icon.svelte
- repo/streak.ts
- vision-board/+page.svelte
- listCategories
- GoalStatusSegment.svelte
- KanbanBoard.svelte
- server/package.json
- containers
- CalendarView.svelte
- calendarGrid.spec.ts
- api/types.ts
- Goal Detail Page
- api/http.ts
- api/index.ts
- TaskDrawer.svelte
- Goal Progress Logic
- Phase 1 API Plan
- requestLog.spec.ts
- settings/+page.svelte
- schemas.ts
- VisionBoard.svelte
- routes/profile.ts
- src/images.ts
- AccountSettings.svelte
- request
- containers
- Phase 2 Web Client Plan
- dashboard.ts
- Bug Log & App Shell
- SubgoalCard.svelte
- login/+page.svelte
- lib/dates.ts
- Project Docs & TODO
- GoalDrawer.svelte
- layout.spec.ts
- CI Steps
- ideas/+page.svelte
- routes/account.ts
- openapi.spec.ts
- Kubernetes runbook
- Auth Init & Profile
- idea.ts
- Runtime Config
- App TS Config
- Hosted Roadmap
- welcome/+page.svelte
- Auth Flow Docs
- gantt.ts
- task.ts
- api/ideas.ts
- ui/index.ts
- Hosted Server Design
- Docker Compose DB
- devDependencies
- App Scripts
- express
- Phase 2 Design Spec
- +layout.svelte
- app/package.json
- CI Concurrency
- Server TS Config
- DashboardVisionPreview.svelte
- Server Design Docs
- Dependabot
- routes/visionItems.ts
- DashboardQuickAdd.svelte
- app.ts
- CI Job Env
- AppError
- API Request Lifecycle (authenticate, withUser tx, afterCommit, errorHandler)
- Mobile Responsive Plan
- CI Defaults
- Writing Guidelines Skill
- CI Postgres Service
- Web Client README
- Popover Positioning
- Design Guide
- CI Job Graph
- api/goals.ts
- SvelteKit Static Adapter
- routes/routes.spec.ts
- src/http.ts
- CI E2E Secrets
- svelte
- Web-only Cutover
- session.svelte.ts
- repo/settings.ts
- Mushpoint privacy policy
- postman.ts
- rls.spec.ts
- ingress.yaml
- App Types
- Robots.txt
- Wrench Icon
- @sveltejs/kit
- listCategories
- moveId
- By chapter
- api-service.yaml
- web-service.yaml
- data
- kind-config.yaml
- containers
- spec
- spec
- configmap-web.yaml
- dashboard.k6.js
- api-deployment.yaml
- namespace.yaml
- livenessProbe
- readinessProbe
- securityContext
- template
- resources
- Icon.svelte
- main.ts
- svelte-check@^4.4.6
- @axe-core/playwright
- VisionImage.svelte
- prettier-plugin-tailwindcss@^0.7.2
- @sveltejs/adapter-auto@^7.0.1
- @types/node@^24.13.3
- typescript@^6.0.2

## God Nodes (most connected - your core abstractions)
1. `vitest` - 68 edges
2. `request()` - 60 edges
3. `svelte` - 35 edges
4. `AppError` - 34 edges
5. `nowIso()` - 31 edges
6. `Phase 1 API Server Implementation Plan` - 30 edges
7. `Mushpoint (root README)` - 30 edges
8. `createApp()` - 29 edges
9. `SqlDriver` - 28 edges
10. `AppError` - 27 edges

## Surprising Connections (you probably didn't know these)
- `V4 Access control` --references--> `isOwnImagePath()`  [INFERRED]
  docs/security/asvs-l1.md → server/src/images.ts
- `V2 Authentication (Supabase Auth)` --references--> `changePassword()`  [INFERRED]
  docs/security/asvs-l1.md → app/src/lib/auth/session.svelte.ts
- `V5 Validation, sanitization and encoding` --references--> `safeHref()`  [INFERRED]
  docs/security/asvs-l1.md → app/src/lib/format.ts
- `Rules that are easy to break` --references--> `isOwnImagePath()`  [INFERRED]
  CLAUDE.md → server/src/images.ts
- `Placeholder Conventions (snake_case, your_access_token_here)` --conceptually_related_to--> `Mushpoint (root README)`  [INFERRED]
  .claude/skills/vercel-writing-guidelines/SKILL.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Browser-to-API Authenticated Request Flow** — docs_auth_getaccesstoken, docs_auth_request, docs_auth_createverifier, docs_auth_withuser, docs_auth_own_rows_policy [EXTRACTED 1.00]
- **Production Security Hardening** — todo_rate_limiting, todo_idor_sweep, todo_security_scanning, todo_web_csp_headers, todo_zod_validation [EXTRACTED 1.00]
- **Account deletion flow (images, rows, auth user, tombstone)** — docs_superpowers_plans_2026_11_08_phase_2_web_client_delete_account_route, docs_superpowers_plans_2026_11_08_phase_2_web_client_removeallfor, docs_superpowers_plans_2026_11_08_phase_2_web_client_deleteallrows, docs_superpowers_plans_2026_11_08_phase_2_web_client_authadmin, docs_superpowers_plans_2026_11_08_phase_2_web_client_deleted_users_tombstone [EXTRACTED 1.00]
- **Per-request user isolation flow (verify token, set app.user_id, RLS)** — docs_superpowers_plans_2026_11_06_phase_1_api_server_authenticate, docs_superpowers_plans_2026_11_06_phase_1_api_server_createverifier, docs_superpowers_plans_2026_11_06_phase_1_api_server_makehandle, docs_superpowers_plans_2026_11_06_phase_1_api_server_withuser, docs_superpowers_plans_2026_11_06_phase_1_api_server_0001_init_sql [EXTRACTED 1.00]
- **Account Deletion and Recovery Flow** — docs_auth_account_deletion_tombstone, docs_auth_finishdeletion, app_readme_route_guard, server_readme_account_deletion, docs_auth_user_tables_test [INFERRED 0.85]

## Communities (133 total, 18 thin omitted)

### Community 0 - "API Route & IDOR Tests"
Cohesion: 0.14
Nodes (17): jose, supertest, createVerifier(), createMemoryImageStore(), build(), pool, users, lines (+9 more)

### Community 1 - ".execute"
Cohesion: 0.10
Nodes (47): bootstrapUser(), deleteAllRows(), exportAllRows(), CategoryRow, create(), duplicateNameAsValidation(), get(), list() (+39 more)

### Community 2 - "SQL Driver & Test DB"
Cohesion: 0.15
Nodes (7): vitest, SqlDriver, createTestDb(), pool(), TABLES, TEST_TZ, TestDb

### Community 3 - "Security Workflow"
Cohesion: 0.05
Nodes (46): name, permissions, runs-on, steps, name, runs-on, steps, strategy (+38 more)

### Community 4 - "E2E & A11y Tests"
Cohesion: 0.08
Nodes (30): PUBLIC_ROUTES, SIGNED_IN_ROUTES, THEMES, WCAG_TAGS, deleteUsers(), APP_ROOT, ENV_FILE, loadE2eEnv() (+22 more)

### Community 5 - "Icon.svelte"
Cohesion: 0.13
Nodes (10): Props, { streaks, class: className = '' }, top, cadence, { card, busy = false, onToggle }, Props, markup, { name, size = 20, label, weight = 1.8, class: className = '' } (+2 more)

### Community 6 - "repo/streak.ts"
Cohesion: 0.26
Nodes (17): addDays(), compareDates(), fromUtcDate(), toUtcDate(), weekdayOf(), expectedDays(), isExpectedOn(), stateOf() (+9 more)

### Community 7 - "vision-board/+page.svelte"
Cohesion: 0.14
Nodes (10): actionError, busy, { data }, deletingItem, drawerOpen, editingItem, items, pendingOrder (+2 more)

### Community 8 - "listCategories"
Cohesion: 0.30
Nodes (10): getGoal(), listGoals(), listStreaks(), listSubgoals(), listTasks(), listVisionItems(), load(), load() (+2 more)

### Community 9 - "GoalStatusSegment.svelte"
Cohesion: 0.07
Nodes (22): { open, title, onClose }, phrase, PHRASES, Props, apply(), buttons, celebrating, confirmArchive() (+14 more)

### Community 10 - "KanbanBoard.svelte"
Cohesion: 0.05
Nodes (48): TASK_STATUSES, activeStatus, busy, clearFilters(), closeMoveMenu(), columns, dragOverStatus, drop() (+40 more)

### Community 11 - "server/package.json"
Cohesion: 0.06
Nodes (40): esbuild, pino, tsx, @types/express, @types/multer, @types/node, @types/pg, @types/supertest (+32 more)

### Community 12 - "containers"
Cohesion: 0.05
Nodes (43): apiVersion, name, image, imagePullPolicy, livenessProbe, name, ports, readinessProbe (+35 more)

### Community 13 - "CalendarView.svelte"
Cohesion: 0.05
Nodes (28): activeDay, busy, byDay, closeDay(), dayPanel, dayPanelClose, dayPanelLeft, dayPanelTop (+20 more)

### Community 14 - "calendarGrid.spec.ts"
Cohesion: 0.20
Nodes (5): dayDots(), defaultSelectedDay(), DOTS_SHOWN, DotTone, dotTone()

### Community 16 - "api/types.ts"
Cohesion: 0.09
Nodes (24): createTask(), deleteTask(), setTaskStatus(), updateTask(), CellState, DayCell, GOAL_STATUS_LABELS, GOAL_STATUSES (+16 more)

### Community 17 - "Goal Detail Page"
Cohesion: 0.07
Nodes (25): accent, actionError, addDirectTask(), addSubgoal(), boardTasks, busy, confirmingDelete, { data } (+17 more)

### Community 18 - "api/http.ts"
Cohesion: 0.14
Nodes (13): ErrorKind, UNREACHABLE_MESSAGE, configured, configureHttp(), HttpOptions, Method, onUnauthenticated, setup() (+5 more)

### Community 19 - "api/index.ts"
Cohesion: 0.13
Nodes (10): contentMissing, error, fileInput, form, { open, item = null, onClose, onSaved }, picking, previewUrl, Props (+2 more)

### Community 20 - "TaskDrawer.svelte"
Cohesion: 0.12
Nodes (11): anchorNote, error, form, {
		open,
		goals,
		subgoals,
		task = null,
		prefillDueDate = null,
		onClose,
		onSaved
	}, parentOptions, Props, shake, subgoalsByGoal (+3 more)

### Community 21 - "Goal Progress Logic"
Cohesion: 0.09
Nodes (40): average(), countsTowardProgress(), goalProgress(), subgoalProgress(), taskCompletion(), fromIdeaIds(), getDetail(), GoalRow (+32 more)

### Community 22 - "Phase 1 API Plan"
Cohesion: 0.14
Nodes (26): JSON Error Format {kind, message}, Phase 1 API Server Implementation Plan, authenticate middleware, bootstrapUser with pg_advisory_xact_lock, createApp / Deps, createMemoryImageStore, createPgDriver / toPg (?N to $N), createPool (pg Pool, bigint as number) (+18 more)

### Community 23 - "requestLog.spec.ts"
Cohesion: 0.10
Nodes (19): DIR, migrate(), owner, createPool(), pool, pool, users, log (+11 more)

### Community 24 - "settings/+page.svelte"
Cohesion: 0.05
Nodes (35): setStreakGraceDays(), tabId(), tabPanelId(), list, {
		tabs,
		value,
		onChange,
		id,
		label,
		class: className = ''
	}, actionError, addCategory(), busy (+27 more)

### Community 25 - "schemas.ts"
Cohesion: 0.07
Nodes (35): Handle, categoriesRouter(), settingsRouter(), streaksRouter(), subgoalsRouter(), tasksRouter(), categoryInput, completionBody (+27 more)

### Community 26 - "VisionBoard.svelte"
Cohesion: 0.18
Nodes (10): announcement, board, dragId, dragOverId, isNote(), isPhoto(), { items, busy, onReorder, onEdit, onDelete, onAddNew }, noteColor() (+2 more)

### Community 27 - "routes/profile.ts"
Cohesion: 0.33
Nodes (7): logFor(), ImageStore, profileRouter(), MAX_IMAGE_BYTES, SIGNED_URL_SECONDS, singleImage(), visionImagesRouter()

### Community 28 - "src/images.ts"
Cohesion: 0.14
Nodes (18): jpegWithGps(), solid(), ascii(), AVATAR_SIZE, checkedUpload(), EXTENSIONS, ImageKind, ImageType (+10 more)

### Community 29 - "AccountSettings.svelte"
Cohesion: 0.08
Nodes (33): exportAccount(), removeAvatar(), setAvatar(), setUsername(), busy, clearAvatar(), confirmPassword, currentPassword (+25 more)

### Community 30 - "request"
Cohesion: 0.15
Nodes (18): createCategory(), deleteCategory(), updateCategory(), request(), promoteIdea(), goalInput, requestMock, setTaskCompletion() (+10 more)

### Community 31 - "containers"
Cohesion: 0.07
Nodes (28): apiVersion, command, env, image, imagePullPolicy, name, resources, securityContext (+20 more)

### Community 32 - "Phase 2 Web Client Plan"
Cohesion: 0.20
Nodes (19): Phase 2 Web Client Implementation Plan, account.ts getProfile / setUsername / deleteAccount, AccountSettings.svelte and SidebarUser.svelte, Client AppError / ErrorKind (adds unauthenticated), AuthAdmin / createSupabaseAuthAdmin, DELETE /api/account route, deleteAllRows account repo, deleted_users tombstone (0004_deleted_users.sql) (+11 more)

### Community 33 - "dashboard.ts"
Cohesion: 0.14
Nodes (14): StreakCard, Subgoal, SubgoalDetail, Props, { tasks, onMutated, onError, class: className = '' }, today, buildUpcomingFeed(), baseGoal (+6 more)

### Community 34 - "Bug Log & App Shell"
Cohesion: 0.13
Nodes (17): SvelteKit App HTML Shell (app.html), Bug Log, Goal Status Change Feedback (archive confirm, completion celebration), Orphaned Tasks on Goal Delete (fixed: prompt user), Subgoal Delete Confirmation, Mushpoint (root README), Data Model (goals, subgoals, tasks, ideas, vision_items, deleted_users...), Retired Desktop App (Tauri + SQLite, tag desktop-sqlite-final) (+9 more)

### Community 35 - "SubgoalCard.svelte"
Cohesion: 0.06
Nodes (30): submit(), addTask(), busy, confirmingDelete, expanded, newTaskRecurrence, newTaskTitle, pendingComplete (+22 more)

### Community 36 - "login/+page.svelte"
Cohesion: 0.16
Nodes (13): PUBLIC_ROUTES, safeNext(), EMAIL_NOT_CONFIRMED, signIn(), busy, deleted, email, error (+5 more)

### Community 37 - "lib/dates.ts"
Cohesion: 0.20
Nodes (13): Recurrence, shiftYear(), DAYS, tasksByDay(), changeYear(), addDays(), fromUtcDate(), isExpectedOn() (+5 more)

### Community 38 - "Project Docs & TODO"
Cohesion: 0.12
Nodes (16): Themes via mushpoint-design CSS Custom Properties, Legibility Floor (WCAG 2 AA + APCA Lc thresholds), Future Cloud Deployment (phase 4), Planned Local Kubernetes kind Cluster (phase 3), Themes (nocturne, coquette) from mushpoint-design, Production Readiness TODO, CI Pipeline (GitHub Actions, Dependabot, npm audit), Data Safety (backups, PITR, restore drill) (+8 more)

### Community 39 - "GoalDrawer.svelte"
Cohesion: 0.12
Nodes (10): error, form, isValidUrl(), {
		open,
		categories,
		goal = null,
		prefill = null,
		create = createGoal,
		onClose,
		onSaved
	}, Props, shake, submit(), submitting (+2 more)

### Community 41 - "CI Steps"
Cohesion: 0.15
Nodes (20): steps, steps, steps, lighthouse, name, runs-on, steps, steps (+12 more)

### Community 42 - "ideas/+page.svelte"
Cohesion: 0.07
Nodes (19): error, form, { open, idea = null, onClose, onSaved }, Props, shake, submitting, titleMissing, actionError (+11 more)

### Community 43 - "routes/account.ts"
Cohesion: 0.22
Nodes (9): pg, AuthAdmin, QueryResult, createPgDriver(), toPg(), DEFAULT_CATEGORIES, withUser(), deleteAccount() (+1 more)

### Community 44 - "openapi.spec.ts"
Cohesion: 0.23
Nodes (10): buildOpenApi(), error(), json(), Method, Op, operation(), OPERATIONS, pool (+2 more)

### Community 45 - "Kubernetes runbook"
Cohesion: 0.08
Nodes (22): Adding CD later, CI/CD pipeline, `ci.yml`: does it build and work, Dependabot, Merging, Secrets, `security.yml`: is it safe to ship, What deploys (+14 more)

### Community 46 - "Auth Init & Profile"
Cohesion: 0.26
Nodes (15): deleteAccount(), getProfile(), Profile, isPublicRoute(), getAccessToken(), signOut(), removeAccount(), finishDeletion() (+7 more)

### Community 47 - "idea.ts"
Cohesion: 0.21
Nodes (12): get(), IdeaRow, listTags(), map(), mapTag(), promote(), promoteToNewGoal(), TagRow (+4 more)

### Community 49 - "Runtime Config"
Cohesion: 0.19
Nodes (9): config, FakeSession, supabase, AppConfig, fetchConfig(), FIELDS, loadConfig(), resetConfigCache() (+1 more)

### Community 50 - "App TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, allowJs, checkJs, esModuleInterop, forceConsistentCasingInFileNames, moduleResolution, resolveJsonModule, rewriteRelativeImportExtensions (+5 more)

### Community 51 - "Hosted Roadmap"
Cohesion: 0.18
Nodes (12): Hosted Mushpoint Roadmap Plan (phases 1-3), bootstrapUser default categories and settings, Ingress single origin (/ web, /api API, limit-rps), Kubernetes Manifests, kind Cluster and Runbook (Task 16), Migration Kubernetes Job using API image, Roadmap Review Focus (isolation, auth, bootstrap, tz, images), withUser per-request transaction scope, Server Dockerfile (node:24-slim multi-stage) (+4 more)

### Community 52 - "welcome/+page.svelte"
Cohesion: 0.06
Nodes (28): USERNAME_PATTERN, failedUrl, initial, { name, url, class: sizing = 'size-8 text-sm' }, Props, showImage, { name, avatarUrl, menuOpen, onMenu, menuButton = $bindable() }, Props (+20 more)

### Community 53 - "Auth Flow Docs"
Cohesion: 0.16
Nodes (13): PKCE Email Callback (/auth/callback), Root Layout Route Guard (+layout.ts), How Sign-In and Data Access Work (auth.md), completeCallback(), finishDeletion(), getAccessToken(), onUnauthenticated() 401 Callback, request() in app/src/lib/api/http.ts (+5 more)

### Community 54 - "gantt.ts"
Cohesion: 0.16
Nodes (13): chart, { goal }, Props, compareDates(), localDateOf(), dayNumber(), earliest(), GanttChart (+5 more)

### Community 55 - "task.ts"
Cohesion: 0.26
Nodes (11): today(), list(), listDirectForGoal(), listForSubgoal(), listRecurring(), map(), TaskRow, withCompletion() (+3 more)

### Community 56 - "api/ideas.ts"
Cohesion: 0.21
Nodes (10): createIdea(), deleteIdea(), getIdea(), listIdeas(), listIdeaTags(), updateIdea(), Idea, IdeaInput (+2 more)

### Community 57 - "ui/index.ts"
Cohesion: 0.06
Nodes (31): Category, delayByGoalId, { goals, categories, class: className = '' }, grouped, Props, { goals, subgoals, tasks, class: className = '' }, KIND_LABELS, Props (+23 more)

### Community 58 - "Hosted Server Design"
Cohesion: 0.21
Nodes (7): mushpoint_app non-owner Postgres role, 0001_init.sql schema with RLS, Hosted Mushpoint Design Spec, Express 5 API Server on Node, Supabase JWKS Token Verification, Private Bucket Images via Signed URLs, Supabase (Postgres, auth, storage)

### Community 59 - "Docker Compose DB"
Cohesion: 0.15
Nodes (12): environment, healthcheck, image, ports, POSTGRES_PASSWORD, interval, retries, test (+4 more)

### Community 60 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, prettier@^3.8.1, prettier-plugin-svelte@^3.5.1, svelte@^5.55.2, @sveltejs/vite-plugin-svelte@^7.0.0, tailwindcss@^4.2.2, vitest@^4.1.12, vitest (+4 more)

### Community 61 - "App Scripts"
Cohesion: 0.17
Nodes (12): scripts, build, check, check:watch, dev, format, lint, prepare (+4 more)

### Community 62 - "express"
Cohesion: 0.17
Nodes (12): express, express-rate-limit, multer, zod, dependencies, express@^5.3.0, express-rate-limit@^8.7.4, jose@^6.2.15 (+4 more)

### Community 63 - "Phase 2 Design Spec"
Cohesion: 0.18
Nodes (8): optimistic() helper with per-key sequencing, Two-user Playwright E2E with admin-created users, Phase 2 Web Client Design Spec, Delete Account Flow (storage, rows, auth user), Phase 2 Risks (Supabase pause, signed URL expiry), Supabase Browser Auth (PKCE, localStorage session), Unique Usernames via profiles table, Vite /api Proxy (no CORS)

### Community 64 - "+layout.svelte"
Cohesion: 0.07
Nodes (24): auth, leave(), leaving, { open, username, avatarUrl, settingsCurrent, onClose }, panel, Props, otherTheme, Props (+16 more)

### Community 65 - "app/package.json"
Cohesion: 0.20
Nodes (10): dependencies, mushpoint-design@git+https://github.com/Vu1nea/Mushpoi..., @supabase/auth-js@^2.119.0, vite@^8.3.8, name, private, type, version (+2 more)

### Community 66 - "CI Concurrency"
Cohesion: 0.18
Nodes (10): concurrency, cancel-in-progress, group, name, on, pull_request, push, permissions (+2 more)

### Community 67 - "Server TS Config"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, skipLibCheck, strict, target (+2 more)

### Community 68 - "DashboardVisionPreview.svelte"
Cohesion: 0.24
Nodes (9): { items, class: className = '' }, preview, Props, boardSurface, noteColorOf(), NOTES, tiltOf(), TILTS (+1 more)

### Community 69 - "Server Design Docs"
Cohesion: 0.29
Nodes (6): createVerifier() JWT Verifier (jose, ES256/RS256), Additive Migrations 0001-0005, Mushpoint API Server README, API Container Image (node:24-slim, migrateCli), Live Smoke Test Results 2026-11-08, Supabase Setup (asymmetric JWT keys, private vision bucket 5 MB)

### Community 70 - "Dependabot"
Cohesion: 0.20
Nodes (9): dependency-type, dev-dependencies, interval, updates, directory, groups, package-ecosystem, schedule (+1 more)

### Community 71 - "routes/visionItems.ts"
Cohesion: 0.13
Nodes (18): Commands, Mushpoint, Rules that are easy to break, Ctx, isOwnImagePath(), goalsRouter(), ownGoalInput(), ideasRouter() (+10 more)

### Community 72 - "DashboardQuickAdd.svelte"
Cohesion: 0.09
Nodes (16): kind, KINDS, { onAdded, onError, class: className = '', bare = false }, Props, QuickAddKind, submitting, title, added() (+8 more)

### Community 73 - "app.ts"
Cohesion: 0.32
Nodes (10): createApp(), Deps, Verifier, errorHandler(), requestLogger(), createLimiters(), DEFAULT_LIMITS, limiter() (+2 more)

### Community 74 - "CI Job Env"
Cohesion: 0.29
Nodes (7): defaults, env, name, runs-on, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, app, env

### Community 75 - "AppError"
Cohesion: 0.16
Nodes (12): localDateOf(), MAX_TEXT, optionalUrl(), parseDateOrThrow(), parseTimezone(), RFC-3339, ymd(), ProfileRow (+4 more)

### Community 76 - "API Request Lifecycle (authenticate, withUser tx, afterCommit, errorHandler)"
Cohesion: 0.18
Nodes (8): own_rows RLS Policy (FORCE ROW LEVEL SECURITY), withUser() Transaction Scope, Error Shape { kind, message }, First-Request Bootstrap (settings + 5 default categories, advisory lock), mushpoint_app Role (NOBYPASSRLS), API Request Lifecycle (authenticate, withUser tx, afterCommit, errorHandler), API Conventions (/api base, bearer auth, X-Timezone, error shape), IDOR Sweep Test (23 id-taking routes)

### Community 77 - "Mobile Responsive Plan"
Cohesion: 0.25
Nodes (7): Bottom tab bar + top bar + menu sheet on phones, FormModal as bottom sheet below md, KanbanBoard one column at a time via Tabs on mobile, Mobile-first with md (768px) shell breakpoint, Playwright iPhone 13 / Pixel 7 projects + no-overflow check, Mobile responsiveness plan, Touch affordances (pointer-coarse, 40px hit areas, 16px inputs)

### Community 78 - "CI Defaults"
Cohesion: 0.25
Nodes (8): run, server, defaults, working-directory, defaults, name, runs-on, services

### Community 80 - "CI Postgres Service"
Cohesion: 0.29
Nodes (7): services, POSTGRES_PASSWORD, env, image, options, ports, postgres

### Community 81 - "Web Client README"
Cohesion: 0.33
Nodes (5): Mushpoint Web Client README, Manual Email Flow Checklist, Runtime config.json (apiUrl, supabaseUrl, supabaseAnonKey), Configuration Reference (server/.env, config.json, .env.e2e), Calculated Progress (goal averages children, only done tasks count)

### Community 83 - "Design Guide"
Cohesion: 0.40
Nodes (5): DESIGN.md Landing Page Design Prompt, Image-First Workflow (brand-kit sheet, then opening section), Landing Page Look (#fbf4ea ground, #7a1f33 brand, EB Garamond + Host Grotesk), Landing Page Sections (header, hero, logos, features, process, testimonials, pricing, FAQ, closing, footer), Design Starting Values (colors, type sizes, spacing, corners)

### Community 84 - "CI Job Graph"
Cohesion: 0.20
Nodes (10): name, runs-on, env, name, needs, runs-on, HAS_SECRETS, jobs (+2 more)

### Community 85 - "api/goals.ts"
Cohesion: 0.20
Nodes (9): createGoal(), deleteGoal(), setGoalStatus(), updateGoal(), withQuery(), Goal, GoalDetail, GoalInput (+1 more)

### Community 86 - "SvelteKit Static Adapter"
Cohesion: 0.40
Nodes (3): @sveltejs/adapter-static@^3.0.11, config, @sveltejs/adapter-static

### Community 87 - "routes/routes.spec.ts"
Cohesion: 0.10
Nodes (15): sharp, USER_TABLES, A, authAdmin, B, C, D, E (+7 more)

### Community 88 - "src/http.ts"
Cohesion: 0.18
Nodes (7): AppError, ErrorKind, authenticate(), INTERNAL, makeHandle(), STATUS, parse()

### Community 89 - "CI E2E Secrets"
Cohesion: 0.40
Nodes (5): E2E_PASSWORD, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL, env

### Community 90 - "svelte"
Cohesion: 0.07
Nodes (22): error, form, Props, { subgoal, onClose, onSaved }, submitting, titleMissing, props, { value = $bindable(), ...rest } (+14 more)

### Community 91 - "Web-only Cutover"
Cohesion: 0.50
Nodes (3): MUSHPOINT_TARGET=web Build Target, Web-only cutover (delete Tauri/SQLite), SQLite to Postgres Port of Repos

### Community 92 - "session.svelte.ts"
Cohesion: 0.08
Nodes (37): AppError, AuthState, CallbackResult, callbackUrl(), changeEmail(), changePassword(), check(), completeCallback() (+29 more)

### Community 93 - "repo/settings.ts"
Cohesion: 0.28
Nodes (6): get(), setGraceDays(), setTheme(), SettingsRow, THEMES, Settings

### Community 94 - "Mushpoint privacy policy"
Cohesion: 0.10
Nodes (18): Changes, Children, How long we keep it, Mushpoint privacy policy, Storage on your device, What we hold, Who else handles your data, Why we hold it (lawful basis) (+10 more)

### Community 95 - "postman.ts"
Cohesion: 0.12
Nodes (20): buildPostman(), CAPTURED, Folder, FOLDERS, goalBody, item(), Method, OPEN (+12 more)

### Community 96 - "rls.spec.ts"
Cohesion: 0.29
Nodes (3): A, app, B

### Community 97 - "ingress.yaml"
Cohesion: 0.11
Nodes (17): nginx.ingress.kubernetes.io/limit-burst-multiplier, nginx.ingress.kubernetes.io/limit-rps, nginx.ingress.kubernetes.io/proxy-body-size, apiVersion, paths, kind, metadata, annotations (+9 more)

### Community 102 - "@sveltejs/kit"
Cohesion: 0.29
Nodes (4): @sveltejs/kit@^2.70.4, @tailwindcss/vite@^4.2.2, @sveltejs/kit, @tailwindcss/vite

### Community 103 - "listCategories"
Cohesion: 0.16
Nodes (12): listCategories(), getSettings(), setActiveTheme(), GoalStatus, Settings, isTheme(), ThemeStore, GoalFilter (+4 more)

### Community 104 - "moveId"
Cohesion: 0.53
Nodes (4): drop(), step(), moveId(), moveIdBy()

### Community 105 - "By chapter"
Cohesion: 0.12
Nodes (17): By chapter, Gaps to act on, Not applicable at Level 1, OWASP ASVS 4.0.3 Level 1 walk, V10 Malicious code, V11 Business logic, V12 Files and resources, V13 API (+9 more)

### Community 106 - "api-service.yaml"
Cohesion: 0.15
Nodes (12): apiVersion, kind, metadata, name, namespace, name, port, targetPort (+4 more)

### Community 107 - "web-service.yaml"
Cohesion: 0.15
Nodes (12): apiVersion, kind, metadata, name, namespace, name, port, targetPort (+4 more)

### Community 108 - "data"
Cohesion: 0.18
Nodes (10): apiVersion, data, LOG_LEVEL, PORT, SUPABASE_URL, TRUST_PROXY, kind, metadata (+2 more)

### Community 109 - "kind-config.yaml"
Cohesion: 0.18
Nodes (10): apiVersion, containerPort, hostPort, protocol, kind, name, nodes, extraPortMappings (+2 more)

### Community 110 - "containers"
Cohesion: 0.20
Nodes (10): env, envFrom, image, imagePullPolicy, lifecycle, name, ports, volumeMounts (+2 more)

### Community 111 - "spec"
Cohesion: 0.22
Nodes (9): app, maxSurge, maxUnavailable, matchLabels, spec, replicas, selector, strategy (+1 more)

### Community 112 - "spec"
Cohesion: 0.22
Nodes (9): type, runAsNonRoot, seccompProfile, securityContext, terminationGracePeriodSeconds, volumes, spec, emptyDir (+1 more)

### Community 113 - "configmap-web.yaml"
Cohesion: 0.25
Nodes (7): apiVersion, data, config.json, kind, metadata, name, namespace

### Community 114 - "dashboard.k6.js"
Cohesion: 0.43
Nodes (5): authHeaders(), dashboard(), options, setup(), tickHabit()

### Community 116 - "api-deployment.yaml"
Cohesion: 0.33
Nodes (5): apiVersion, kind, metadata, name, namespace

### Community 117 - "namespace.yaml"
Cohesion: 0.40
Nodes (4): apiVersion, kind, metadata, name

### Community 118 - "livenessProbe"
Cohesion: 0.50
Nodes (4): livenessProbe, failureThreshold, httpGet, periodSeconds

### Community 119 - "readinessProbe"
Cohesion: 0.50
Nodes (4): readinessProbe, failureThreshold, httpGet, periodSeconds

### Community 120 - "securityContext"
Cohesion: 0.50
Nodes (4): securityContext, allowPrivilegeEscalation, capabilities, readOnlyRootFilesystem

### Community 121 - "template"
Cohesion: 0.50
Nodes (4): app, labels, template, metadata

### Community 122 - "resources"
Cohesion: 0.67
Nodes (3): resources, limits, requests

### Community 123 - "Icon.svelte"
Cohesion: 0.28
Nodes (7): { items, isCurrent }, Props, AppIconName, appIcons, iconMarkup(), IconName, isAppIcon()

### Community 124 - "main.ts"
Cohesion: 0.10
Nodes (18): createMemoryAuthAdmin(), createSupabaseAuthAdmin(), Config, loadConfig(), REQUIRED, base, createSupabaseImageStore(), createLogger() (+10 more)

## Knowledge Gaps
- **44 isolated node(s):** `RFC-3339`, `./.svelte-kit/tsconfig.json`, `RFC-3339`, `robots.txt (allow all crawling)`, `Wrench Icon SVG` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1056 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `SQL Driver & Test DB` to `API Route & IDOR Tests`, `Icon.svelte`, `repo/streak.ts`, `GoalStatusSegment.svelte`, `KanbanBoard.svelte`, `server/package.json`, `calendarGrid.spec.ts`, `selectOptions.spec.ts`, `api/http.ts`, `Goal Progress Logic`, `requestLog.spec.ts`, `settings/+page.svelte`, `schemas.ts`, `src/images.ts`, `AccountSettings.svelte`, `request`, `dashboard.ts`, `SubgoalCard.svelte`, `login/+page.svelte`, `lib/dates.ts`, `layout.spec.ts`, `openapi.spec.ts`, `Runtime Config`, `gantt.ts`, `ui/index.ts`, `AppError`, `Popover Positioning`, `api/goals.ts`, `routes/routes.spec.ts`, `src/http.ts`, `svelte`, `postman.ts`, `rls.spec.ts`, `@sveltejs/kit`, `moveId`, `VisionBoard.spec.ts`, `main.ts`?**
  _High betweenness centrality (0.278) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `request()` (e.g. with `index.spec.ts` and `lib/images.spec.ts`) actually correct?**
  _`request()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-3339`, `./.svelte-kit/tsconfig.json`, `RFC-3339` to the rest of the system?**
  _44 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Route & IDOR Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.13793103448275862 - nodes in this community are weakly interconnected._
- **Why does `OWASP ASVS 4.0.3 Level 1 walk` connect `By chapter` to `Auth Flow Docs`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **Should `.execute` be split into smaller, more focused modules?**
  _Cohesion score 0.1048265460030166 - nodes in this community are weakly interconnected._
- **Should `Security Workflow` be split into smaller, more focused modules?**
  _Cohesion score 0.05180388529139685 - nodes in this community are weakly interconnected._