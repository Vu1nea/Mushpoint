# Graph Report - Mushpoint  (2026-11-20)

## Corpus Check
- 291 files · ~135,531 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 10, .example 2, .conf 2)

## Summary
- 2246 nodes · 4628 edges · 126 communities (111 shown, 15 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 142 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0975a8b7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- API Route & IDOR Tests
- Repo Row Mapping
- SQL Driver & Test DB
- Security Workflow
- E2E & A11y Tests
- ui/index.ts
- repo/streak.ts
- Auth Session & Callback
- listCategories
- GoalStatusSegment.svelte
- KanbanBoard.svelte
- devDependencies
- containers
- CalendarView.svelte
- VisionItemDrawer.svelte
- api/types.ts
- Goal Detail Page
- api/index.ts
- DashboardQuickAdd.svelte
- TaskDrawer.svelte
- Goal Progress Logic
- Phase 1 API Plan
- Task Manager Page & Tabs
- Categories Settings
- schemas.ts
- vision-board/+page.svelte
- app.ts
- Logging, Pool & Shutdown
- AccountSettings.svelte
- Calendar Grid & Gantt View
- containers
- Phase 2 Web Client Plan
- helpers.ts
- Bug Log & App Shell
- Icon.svelte
- Route Guards
- Date Picker Calendar
- Project Docs & TODO
- GoalDrawer.svelte
- listCategories
- CI Steps
- ideas/+page.svelte
- SubgoalCard.svelte
- VisionBoard.svelte
- Kubernetes runbook
- Auth Init & Profile
- idea.ts
- Runtime Config
- App TS Config
- Hosted Roadmap
- optimistic
- Auth Flow Docs
- gantt.ts
- welcome/+page.svelte
- SubgoalDrawer.svelte
- +layout.svelte
- Hosted Server Design
- Docker Compose DB
- App Dev Dependencies
- App Scripts
- server/package.json
- Phase 2 Design Spec
- src/images.ts
- App Runtime Dependencies
- CI Concurrency
- Server TS Config
- kanban.ts
- Server Design Docs
- Dependabot
- Server Runtime Dependencies
- TaskRow.svelte
- openapi.spec.ts
- CI Job Env
- AppError
- RLS as Isolation Boundary
- Mobile Responsive Plan
- CI Defaults
- Writing Guidelines Skill
- CI Postgres Service
- Web Client README
- Popover Positioning
- Design Guide
- CI Job Graph
- scripts
- SvelteKit Static Adapter
- layout.spec.ts
- request
- CI E2E Secrets
- svelte
- Web-only Cutover
- Prettier
- api/ideas.ts
- Mushpoint privacy policy
- postman.ts
- goals/+page.svelte
- ingress.yaml
- App Types
- Robots.txt
- Wrench Icon
- @sveltejs/kit
- typescript@^6.0.2
- routes/routes.spec.ts
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
- rls.spec.ts
- api-deployment.yaml
- namespace.yaml
- livenessProbe
- readinessProbe
- securityContext
- template
- resources
- prettier-plugin-svelte@^3.5.1
- @types/node@^24.13.3

## God Nodes (most connected - your core abstractions)
1. `request()` - 60 edges
2. `svelte` - 34 edges
3. `AppError` - 33 edges
4. `nowIso()` - 31 edges
5. `Phase 1 API Server Implementation Plan` - 30 edges
6. `Mushpoint (root README)` - 30 edges
7. `createApp()` - 29 edges
8. `SqlDriver` - 28 edges
9. `AppError` - 27 edges
10. `express` - 26 edges

## Surprising Connections (you probably didn't know these)
- `V2 Authentication (Supabase Auth)` --references--> `changePassword()`  [INFERRED]
  docs/security/asvs-l1.md → app/src/lib/auth/session.svelte.ts
- `Rules that are easy to break` --references--> `isOwnImagePath()`  [INFERRED]
  CLAUDE.md → server/src/images.ts
- `V4 Access control` --references--> `isOwnImagePath()`  [INFERRED]
  docs/security/asvs-l1.md → server/src/images.ts
- `V5 Validation, sanitization and encoding` --references--> `safeHref()`  [INFERRED]
  docs/security/asvs-l1.md → app/src/lib/format.ts
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

## Communities (126 total, 15 thin omitted)

### Community 0 - "API Route & IDOR Tests"
Cohesion: 0.07
Nodes (40): jose, supertest, createVerifier(), Verifier, toPg(), createPool(), pool, users (+32 more)

### Community 1 - "Repo Row Mapping"
Cohesion: 0.12
Nodes (36): remove(), set(), ensureExists(), remove(), setStatus(), nowIso(), create(), get() (+28 more)

### Community 2 - "SQL Driver & Test DB"
Cohesion: 0.10
Nodes (15): QueryResult, SqlDriver, createPgDriver(), bootstrapUser(), DEFAULT_CATEGORIES, deleteAllRows(), exportAllRows(), KEPT (+7 more)

### Community 3 - "Security Workflow"
Cohesion: 0.05
Nodes (46): name, permissions, runs-on, steps, name, runs-on, steps, strategy (+38 more)

### Community 4 - "E2E & A11y Tests"
Cohesion: 0.07
Nodes (34): PUBLIC_ROUTES, SIGNED_IN_ROUTES, THEMES, WCAG_TAGS, deleteUsers(), APP_ROOT, ENV_FILE, loadE2eEnv() (+26 more)

### Community 5 - "ui/index.ts"
Cohesion: 0.08
Nodes (21): CellState, DayCell, delayByGoalId, { goals, categories, class: className = '' }, Props, { goals, subgoals, tasks, class: className = '' }, KIND_LABELS, Props (+13 more)

### Community 6 - "repo/streak.ts"
Cohesion: 0.15
Nodes (30): addDays(), compareDates(), fromUtcDate(), toUtcDate(), weekdayOf(), expectedDays(), isExpectedOn(), stateOf() (+22 more)

### Community 7 - "Auth Session & Callback"
Cohesion: 0.08
Nodes (37): AppError, AuthState, CallbackResult, callbackUrl(), changeEmail(), changePassword(), check(), completeCallback() (+29 more)

### Community 8 - "listCategories"
Cohesion: 0.30
Nodes (10): getGoal(), listGoals(), listStreaks(), listSubgoals(), listTasks(), listVisionItems(), load(), load() (+2 more)

### Community 9 - "GoalStatusSegment.svelte"
Cohesion: 0.06
Nodes (25): { open, title, onClose }, phrase, PHRASES, Props, apply(), buttons, celebrating, confirmArchive() (+17 more)

### Community 10 - "KanbanBoard.svelte"
Cohesion: 0.05
Nodes (33): activeStatus, busy, clearFilters(), closeMoveMenu(), columns, dragOverStatus, due, DUE_OPTIONS (+25 more)

### Community 11 - "devDependencies"
Cohesion: 0.12
Nodes (16): tsx, @types/multer, @types/pg, @types/supertest, devDependencies, supertest@^7.3.1, tsx@^4.23.15, @types/multer@^2.3.0 (+8 more)

### Community 12 - "containers"
Cohesion: 0.05
Nodes (43): apiVersion, name, image, imagePullPolicy, livenessProbe, name, ports, readinessProbe (+35 more)

### Community 13 - "CalendarView.svelte"
Cohesion: 0.05
Nodes (28): activeDay, busy, byDay, closeDay(), dayPanel, dayPanelClose, dayPanelLeft, dayPanelTop (+20 more)

### Community 14 - "VisionItemDrawer.svelte"
Cohesion: 0.11
Nodes (15): contentMissing, error, fileInput, form, { open, item = null, onClose, onSaved }, pickImage(), picking, previewUrl (+7 more)

### Community 16 - "api/types.ts"
Cohesion: 0.08
Nodes (33): createTask(), deleteTask(), setTaskStatus(), updateTask(), GOAL_STATUS_LABELS, GOAL_STATUSES, GoalSummary, Recurrence (+25 more)

### Community 17 - "Goal Detail Page"
Cohesion: 0.07
Nodes (25): accent, actionError, addDirectTask(), addSubgoal(), boardTasks, busy, confirmingDelete, { data } (+17 more)

### Community 18 - "api/index.ts"
Cohesion: 0.13
Nodes (11): ErrorKind, UNREACHABLE_MESSAGE, configured, configureHttp(), HttpOptions, Method, onUnauthenticated, setup() (+3 more)

### Community 19 - "DashboardQuickAdd.svelte"
Cohesion: 0.14
Nodes (9): kind, KINDS, { onAdded, onError, class: className = '' }, Props, QuickAddKind, submitting, title, actionError (+1 more)

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
Cohesion: 0.10
Nodes (37): average(), countsTowardProgress(), goalProgress(), subgoalProgress(), taskCompletion(), fromIdeaIds(), getDetail(), GoalRow (+29 more)

### Community 22 - "Phase 1 API Plan"
Cohesion: 0.14
Nodes (26): JSON Error Format {kind, message}, Phase 1 API Server Implementation Plan, authenticate middleware, bootstrapUser with pg_advisory_xact_lock, createApp / Deps, createMemoryImageStore, createPgDriver / toPg (?N to $N), createPool (pg Pool, bigint as number) (+18 more)

### Community 23 - "Task Manager Page & Tabs"
Cohesion: 0.10
Nodes (17): tabId(), tabPanelId(), list, {
		tabs,
		value,
		onChange,
		id,
		label,
		class: className = ''
	}, panel(), actionError, busy, { data } (+9 more)

### Community 24 - "Categories Settings"
Cohesion: 0.06
Nodes (30): setActiveTheme(), setStreakGraceDays(), otherTheme, Props, { showLabel = true }, isTheme(), theme, THEME_LABELS (+22 more)

### Community 25 - "schemas.ts"
Cohesion: 0.05
Nodes (45): Commands, Mushpoint, Rules that are easy to break, V4 Access control, Ctx, isOwnImagePath(), goalsRouter(), ownGoalInput() (+37 more)

### Community 26 - "vision-board/+page.svelte"
Cohesion: 0.14
Nodes (10): actionError, busy, { data }, deletingItem, drawerOpen, editingItem, items, pendingOrder (+2 more)

### Community 27 - "app.ts"
Cohesion: 0.13
Nodes (31): express, pg, createApp(), Deps, AuthAdmin, withUser(), authenticate(), errorHandler() (+23 more)

### Community 28 - "Logging, Pool & Shutdown"
Cohesion: 0.09
Nodes (21): createMemoryAuthAdmin(), createSupabaseAuthAdmin(), Config, loadConfig(), REQUIRED, base, pool, createSupabaseImageStore() (+13 more)

### Community 29 - "AccountSettings.svelte"
Cohesion: 0.08
Nodes (30): exportAccount(), removeAvatar(), setAvatar(), busy, clearAvatar(), confirmPassword, currentPassword, deleteConfirmed (+22 more)

### Community 30 - "Calendar Grid & Gantt View"
Cohesion: 0.20
Nodes (5): dayDots(), defaultSelectedDay(), DOTS_SHOWN, DotTone, dotTone()

### Community 31 - "containers"
Cohesion: 0.07
Nodes (28): apiVersion, command, env, image, imagePullPolicy, name, resources, securityContext (+20 more)

### Community 32 - "Phase 2 Web Client Plan"
Cohesion: 0.20
Nodes (19): Phase 2 Web Client Implementation Plan, account.ts getProfile / setUsername / deleteAccount, AccountSettings.svelte and SidebarUser.svelte, Client AppError / ErrorKind (adds unauthenticated), AuthAdmin / createSupabaseAuthAdmin, DELETE /api/account route, deleteAllRows account repo, deleted_users tombstone (0004_deleted_users.sql) (+11 more)

### Community 33 - "helpers.ts"
Cohesion: 0.20
Nodes (19): CategoryRow, create(), duplicateNameAsValidation(), get(), list(), map(), update(), create() (+11 more)

### Community 34 - "Bug Log & App Shell"
Cohesion: 0.13
Nodes (17): SvelteKit App HTML Shell (app.html), Bug Log, Goal Status Change Feedback (archive confirm, completion celebration), Orphaned Tasks on Goal Delete (fixed: prompt user), Subgoal Delete Confirmation, Mushpoint (root README), Data Model (goals, subgoals, tasks, ideas, vision_items, deleted_users...), Retired Desktop App (Tauri + SQLite, tag desktop-sqlite-final) (+9 more)

### Community 35 - "Icon.svelte"
Cohesion: 0.10
Nodes (16): Props, { streaks, class: className = '' }, top, { items, isCurrent }, Props, cadence, { card, busy = false, onToggle }, Props (+8 more)

### Community 36 - "Route Guards"
Cohesion: 0.14
Nodes (15): isPublicRoute(), PUBLIC_ROUTES, safeNext(), EMAIL_NOT_CONFIRMED, signIn(), bare, busy, deleted (+7 more)

### Community 37 - "Date Picker Calendar"
Cohesion: 0.22
Nodes (13): shiftYear(), DAYS, tasksByDay(), changeYear(), addDays(), fromUtcDate(), isExpectedOn(), localDateOf() (+5 more)

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

### Community 40 - "listCategories"
Cohesion: 0.19
Nodes (12): listCategories(), listIdeas(), listIdeaTags(), getSettings(), GoalStatus, Settings, GoalFilter, load() (+4 more)

### Community 41 - "CI Steps"
Cohesion: 0.15
Nodes (20): steps, steps, steps, lighthouse, name, runs-on, steps, steps (+12 more)

### Community 42 - "ideas/+page.svelte"
Cohesion: 0.07
Nodes (19): error, form, { open, idea = null, onClose, onSaved }, Props, shake, submitting, titleMissing, actionError (+11 more)

### Community 43 - "SubgoalCard.svelte"
Cohesion: 0.14
Nodes (11): addTask(), busy, confirmingDelete, expanded, newTaskRecurrence, newTaskTitle, pendingComplete, Props (+3 more)

### Community 44 - "VisionBoard.svelte"
Cohesion: 0.11
Nodes (16): gridClass, { items, class: className = '' }, preview, Props, announcement, board, dragId, dragOverId (+8 more)

### Community 45 - "Kubernetes runbook"
Cohesion: 0.08
Nodes (22): Adding CD later, CI/CD pipeline, `ci.yml`: does it build and work, Dependabot, Merging, Secrets, `security.yml`: is it safe to ship, What deploys (+14 more)

### Community 46 - "Auth Init & Profile"
Cohesion: 0.20
Nodes (17): deleteAccount(), getProfile(), Profile, getAccessToken(), signOut(), removeAccount(), leave(), leave() (+9 more)

### Community 47 - "idea.ts"
Cohesion: 0.27
Nodes (8): IdeaRow, listTags(), map(), mapTag(), TagRow, tagsForIdea(), Idea, Tag

### Community 49 - "Runtime Config"
Cohesion: 0.19
Nodes (9): config, FakeSession, supabase, AppConfig, fetchConfig(), FIELDS, loadConfig(), resetConfigCache() (+1 more)

### Community 50 - "App TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, allowJs, checkJs, esModuleInterop, forceConsistentCasingInFileNames, moduleResolution, resolveJsonModule, rewriteRelativeImportExtensions (+5 more)

### Community 51 - "Hosted Roadmap"
Cohesion: 0.18
Nodes (12): Hosted Mushpoint Roadmap Plan (phases 1-3), bootstrapUser default categories and settings, Ingress single origin (/ web, /api API, limit-rps), Kubernetes Manifests, kind Cluster and Runbook (Task 16), Migration Kubernetes Job using API image, Roadmap Review Focus (isolation, auth, bootstrap, tz, images), withUser per-request transaction scope, Server Dockerfile (node:24-slim multi-stage) (+4 more)

### Community 52 - "optimistic"
Cohesion: 0.16
Nodes (13): submit(), toggleComplete(), drop(), moveTask(), step(), toggle(), latest, optimistic() (+5 more)

### Community 53 - "Auth Flow Docs"
Cohesion: 0.14
Nodes (15): PKCE Email Callback (/auth/callback), Root Layout Route Guard (+layout.ts), How Sign-In and Data Access Work (auth.md), completeCallback(), finishDeletion(), getAccessToken(), onUnauthenticated() 401 Callback, own_rows RLS Policy (FORCE ROW LEVEL SECURITY) (+7 more)

### Community 54 - "gantt.ts"
Cohesion: 0.16
Nodes (12): chart, { goal }, Props, compareDates(), dayNumber(), earliest(), GanttChart, ganttChart() (+4 more)

### Community 55 - "welcome/+page.svelte"
Cohesion: 0.22
Nodes (9): setUsername(), USERNAME_PATTERN, saveProfile(), busy, error, leaving, saving, submit() (+1 more)

### Community 56 - "SubgoalDrawer.svelte"
Cohesion: 0.12
Nodes (9): error, form, Props, { subgoal, onClose, onSaved }, submitting, titleMissing, Props, { value = $bindable(''), class: className = '', ...rest } (+1 more)

### Community 57 - "+layout.svelte"
Cohesion: 0.05
Nodes (35): auth, failedUrl, initial, { name, url, class: sizing = 'size-8 text-sm' }, Props, showImage, leaving, { open, username, avatarUrl, settingsCurrent, onClose } (+27 more)

### Community 58 - "Hosted Server Design"
Cohesion: 0.21
Nodes (7): mushpoint_app non-owner Postgres role, 0001_init.sql schema with RLS, Hosted Mushpoint Design Spec, Express 5 API Server on Node, Supabase JWKS Token Verification, Private Bucket Images via Signed URLs, Supabase (Postgres, auth, storage)

### Community 59 - "Docker Compose DB"
Cohesion: 0.15
Nodes (12): environment, healthcheck, image, ports, POSTGRES_PASSWORD, interval, retries, test (+4 more)

### Community 60 - "App Dev Dependencies"
Cohesion: 0.14
Nodes (14): devDependencies, prettier-plugin-tailwindcss@^0.7.2, svelte@^5.55.2, svelte-check@^4.4.6, @sveltejs/adapter-auto@^7.0.1, @sveltejs/vite-plugin-svelte@^7.0.0, tailwindcss@^4.2.2, vitest@^4.1.12 (+6 more)

### Community 61 - "App Scripts"
Cohesion: 0.17
Nodes (12): scripts, build, check, check:watch, dev, format, lint, prepare (+4 more)

### Community 62 - "server/package.json"
Cohesion: 0.15
Nodes (12): esbuild, @types/express, esbuild@^0.28.2, @types/express@^5.0.6, directories, test, engines, node (+4 more)

### Community 63 - "Phase 2 Design Spec"
Cohesion: 0.18
Nodes (8): optimistic() helper with per-key sequencing, Two-user Playwright E2E with admin-created users, Phase 2 Web Client Design Spec, Delete Account Flow (storage, rows, auth user), Phase 2 Risks (Supabase pause, signed URL expiry), Supabase Browser Auth (PKCE, localStorage session), Unique Usernames via profiles table, Vite /api Proxy (no CORS)

### Community 64 - "src/images.ts"
Cohesion: 0.12
Nodes (18): multer, multer@^2.5.0, ascii(), checkedUpload(), EXTENSIONS, ImageType, sniffImageType(), GIF (+10 more)

### Community 65 - "App Runtime Dependencies"
Cohesion: 0.17
Nodes (12): dependencies, mushpoint-design@git+https://github.com/Vu1nea/Mushpoi..., @supabase/auth-js@^2.119.0, @axe-core/playwright@^4.14.0, vite@^8.3.8, name, private, type (+4 more)

### Community 66 - "CI Concurrency"
Cohesion: 0.18
Nodes (10): concurrency, cancel-in-progress, group, name, on, pull_request, push, permissions (+2 more)

### Community 67 - "Server TS Config"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, skipLibCheck, strict, target (+2 more)

### Community 68 - "kanban.ts"
Cohesion: 0.23
Nodes (12): TASK_STATUSES, dueTone(), DueFilter, filterTasks(), groupByStatus(), moveTargets(), NO_FILTER, PAGE_SIZE (+4 more)

### Community 69 - "Server Design Docs"
Cohesion: 0.15
Nodes (10): createVerifier() JWT Verifier (jose, ES256/RS256), Error Shape { kind, message }, First-Request Bootstrap (settings + 5 default categories, advisory lock), Additive Migrations 0001-0005, API Request Lifecycle (authenticate, withUser tx, afterCommit, errorHandler), Mushpoint API Server README, API Container Image (node:24-slim, migrateCli), API Conventions (/api base, bearer auth, X-Timezone, error shape) (+2 more)

### Community 70 - "Dependabot"
Cohesion: 0.20
Nodes (9): dependency-type, dev-dependencies, interval, updates, directory, groups, package-ecosystem, schedule (+1 more)

### Community 71 - "Server Runtime Dependencies"
Cohesion: 0.20
Nodes (10): express-rate-limit, pino, zod, dependencies, express@^5.3.0, express-rate-limit@^8.7.4, jose@^6.2.15, pg@^8.23.1 (+2 more)

### Community 72 - "TaskRow.svelte"
Cohesion: 0.12
Nodes (12): Props, { tasks, onMutated, onError, class: className = '' }, today, busy, confirmingDelete, done, pendingDone, Props (+4 more)

### Community 73 - "openapi.spec.ts"
Cohesion: 0.33
Nodes (7): buildOpenApi(), error(), json(), Method, Op, operation(), out

### Community 74 - "CI Job Env"
Cohesion: 0.29
Nodes (7): defaults, env, name, runs-on, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, app, env

### Community 75 - "AppError"
Cohesion: 0.11
Nodes (10): AppError, ErrorKind, ProfileRow, setAvatar(), setUsername(), StoredProfile, SettingsRow, THEMES (+2 more)

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

### Community 85 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, check, db:down, db:up, dev, migrate, openapi (+3 more)

### Community 86 - "SvelteKit Static Adapter"
Cohesion: 0.40
Nodes (3): @sveltejs/adapter-static@^3.0.11, config, @sveltejs/adapter-static

### Community 88 - "request"
Cohesion: 0.14
Nodes (19): createCategory(), deleteCategory(), updateCategory(), request(), promoteIdea(), goalInput, requestMock, setTaskCompletion() (+11 more)

### Community 89 - "CI E2E Secrets"
Cohesion: 0.40
Nodes (5): E2E_PASSWORD, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL, env

### Community 90 - "svelte"
Cohesion: 0.19
Nodes (10): props, { value = $bindable(), ...rest }, props, props, props, { value = $bindable(), ...rest }, { tags = $bindable(), ...rest }, props (+2 more)

### Community 91 - "Web-only Cutover"
Cohesion: 0.50
Nodes (3): MUSHPOINT_TARGET=web Build Target, Web-only cutover (delete Tauri/SQLite), SQLite to Postgres Port of Repos

### Community 93 - "api/ideas.ts"
Cohesion: 0.13
Nodes (15): createGoal(), deleteGoal(), setGoalStatus(), updateGoal(), createIdea(), deleteIdea(), getIdea(), updateIdea() (+7 more)

### Community 94 - "Mushpoint privacy policy"
Cohesion: 0.10
Nodes (18): Changes, Children, How long we keep it, Mushpoint privacy policy, Storage on your device, What we hold, Who else handles your data, Why we hold it (lawful basis) (+10 more)

### Community 95 - "postman.ts"
Cohesion: 0.13
Nodes (18): buildPostman(), CAPTURED, Folder, FOLDERS, goalBody, item(), Method, OPEN (+10 more)

### Community 96 - "goals/+page.svelte"
Cohesion: 0.12
Nodes (13): Category, grouped, CATEGORY_COLOR_TOKENS, categoryColor(), colorForCategoryId(), TOKEN_VARIABLES, categoryFilter, { data } (+5 more)

### Community 97 - "ingress.yaml"
Cohesion: 0.11
Nodes (17): nginx.ingress.kubernetes.io/limit-burst-multiplier, nginx.ingress.kubernetes.io/limit-rps, nginx.ingress.kubernetes.io/proxy-body-size, apiVersion, paths, kind, metadata, annotations (+9 more)

### Community 102 - "@sveltejs/kit"
Cohesion: 0.29
Nodes (4): @sveltejs/kit@^2.70.4, @tailwindcss/vite@^4.2.2, @sveltejs/kit, @tailwindcss/vite

### Community 104 - "routes/routes.spec.ts"
Cohesion: 0.13
Nodes (11): A, authAdmin, B, C, D, E, goalBody, groups (+3 more)

### Community 105 - "By chapter"
Cohesion: 0.14
Nodes (14): By chapter, Gaps to act on, Not applicable at Level 1, OWASP ASVS 4.0.3 Level 1 walk, V10 Malicious code, V11 Business logic, V12 Files and resources, V13 API (+6 more)

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

### Community 115 - "rls.spec.ts"
Cohesion: 0.29
Nodes (3): A, app, B

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

## Knowledge Gaps
- **44 isolated node(s):** `RFC-3339`, `./.svelte-kit/tsconfig.json`, `RFC-3339`, `robots.txt (allow all crawling)`, `Wrench Icon SVG` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1047 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `By chapter` connect `By chapter` to `schemas.ts`, `ui/index.ts`, `Auth Session & Callback`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `request()` (e.g. with `index.spec.ts` and `lib/images.spec.ts`) actually correct?**
  _`request()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-3339`, `./.svelte-kit/tsconfig.json`, `RFC-3339` to the rest of the system?**
  _44 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Route & IDOR Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.07071887784921099 - nodes in this community are weakly interconnected._
- **Why does `OWASP ASVS 4.0.3 Level 1 walk` connect `By chapter` to `Auth Flow Docs`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Should `Repo Row Mapping` be split into smaller, more focused modules?**
  _Cohesion score 0.11923076923076924 - nodes in this community are weakly interconnected._
- **Why does `How Sign-In and Data Access Work (auth.md)` connect `Auth Flow Docs` to `Web Client README`, `Bug Log & App Shell`, `Server Design Docs`, `Project Docs & TODO`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._