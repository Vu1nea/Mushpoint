# Graph Report - Mushpoint  (2026-11-21)

## Corpus Check
- 310 files · ~148,646 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 10, .example 2, .conf 2)

## Summary
- 2428 nodes · 5014 edges · 128 communities (114 shown, 14 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 147 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dac5a27d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- export.spec.ts
- .execute
- SQL Driver & Test DB
- Security Workflow
- E2E & A11y Tests
- StreakHeatmap.svelte
- CalendarView.svelte
- DashboardTasksToday.svelte
- Global Constraints
- db/repo/streak.ts
- with
- server/package.json
- app.ts
- ideas/+page.svelte
- ui.ts
- api/types.ts
- Goal Detail Page
- ImageSlot
- vision-board/+page.svelte
- GoalStatusSegment.svelte
- Goal Progress Logic
- Phase 1 API Plan
- CommandPalette.svelte
- tasks/+page.svelte
- app/package.json
- welcome/+page.svelte
- app.ts
- Self-review notes
- VisionItemDrawer.svelte
- request
- tauri.conf.json
- Phase 2 Web Client Plan
- TaskRow.svelte
- Bug Log & App Shell
- tasks/+page.svelte
- layout.spec.ts
- db/repo/task.ts
- Project Docs & TODO
- listGoals
- OWASP ASVS 4.0.3 Level 1 walk
- CI Steps
- Screens
- TaskListView.svelte
- prettier@^3.8.1
- createExternalModules
- Auth Init & Profile
- TaskSummary
- Runtime Config
- App TS Config
- Hosted Roadmap
- MobileMenuSheet.svelte
- Auth Flow Docs
- SubgoalCard.svelte
- UI redesign: flat surface, dense rows
- kanban.ts
- Custom Select & Date Picker — Design
- Hosted Server Design
- Docker Compose DB
- devDependencies
- App Scripts
- welcome/+page.svelte
- Phase 2 Design Spec
- +layout.svelte
- dependencies
- CI Concurrency
- Server TS Config
- signup/+page.svelte
- Server Design Docs
- Dependabot
- routes/visionItems.ts
- MobileQuickAdd.svelte
- Mushpoint
- CI Job Env
- src/types.ts
- RLS as Isolation Boundary
- Mobile Responsive Plan
- CI Defaults
- Writing Guidelines Skill
- CI Postgres Service
- Web Client README
- Popover Positioning
- Design Guide
- CI Job Graph
- Architecture decisions
- SvelteKit Static Adapter
- goals/+page.ts
- logger.ts
- CI E2E Secrets
- +layout.ts
- Web-only Cutover
- vitest@^4.1.3
- prettier@^3.8.1
- build.rs
- main.rs
- mockup-next-steps.md
- post-checkout
- App Types
- Robots.txt
- Wrench Icon
- app
- api/settings.ts
- vitest@^4.1.12
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
- api/visionItems.ts
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
- @types/node@^24.13.3

## God Nodes (most connected - your core abstractions)
1. `request()` - 60 edges
2. `mushpoint-design` - 47 edges
3. `AppError` - 34 edges
4. `svelte` - 31 edges
5. `nowIso()` - 31 edges
6. `Phase 1 API Server Implementation Plan` - 30 edges
7. `Mushpoint (root README)` - 30 edges
8. `createApp()` - 29 edges
9. `SqlDriver` - 28 edges
10. `AppError` - 27 edges

## Surprising Connections (you probably didn't know these)
- `Rules that are easy to break` --references--> `isOwnImagePath()`  [INFERRED]
  CLAUDE.md → server/src/images.ts
- `V4 Access control` --references--> `isOwnImagePath()`  [INFERRED]
  docs/security/asvs-l1.md → server/src/images.ts
- `V2 Authentication (Supabase Auth)` --references--> `changePassword()`  [INFERRED]
  docs/security/asvs-l1.md → app/src/lib/auth/session.svelte.ts
- `Task 8: Dashboard` --references--> `dashboardStats()`  [INFERRED]
  docs/superpowers/plans/2026-11-21-ui-redesign.md → app/src/lib/dashboard.ts
- `Task 9: Tasks screen` --references--> `statusTone()`  [INFERRED]
  docs/superpowers/plans/2026-11-21-ui-redesign.md → app/src/lib/statusTone.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Browser-to-API Authenticated Request Flow** — docs_auth_getaccesstoken, docs_auth_request, docs_auth_createverifier, docs_auth_withuser, docs_auth_own_rows_policy [EXTRACTED 1.00]
- **Production Security Hardening** — todo_rate_limiting, todo_idor_sweep, todo_security_scanning, todo_web_csp_headers, todo_zod_validation [EXTRACTED 1.00]
- **Account deletion flow (images, rows, auth user, tombstone)** — docs_superpowers_plans_2026_11_08_phase_2_web_client_delete_account_route, docs_superpowers_plans_2026_11_08_phase_2_web_client_removeallfor, docs_superpowers_plans_2026_11_08_phase_2_web_client_deleteallrows, docs_superpowers_plans_2026_11_08_phase_2_web_client_authadmin, docs_superpowers_plans_2026_11_08_phase_2_web_client_deleted_users_tombstone [EXTRACTED 1.00]
- **Per-request user isolation flow (verify token, set app.user_id, RLS)** — docs_superpowers_plans_2026_11_06_phase_1_api_server_authenticate, docs_superpowers_plans_2026_11_06_phase_1_api_server_createverifier, docs_superpowers_plans_2026_11_06_phase_1_api_server_makehandle, docs_superpowers_plans_2026_11_06_phase_1_api_server_withuser, docs_superpowers_plans_2026_11_06_phase_1_api_server_0001_init_sql [EXTRACTED 1.00]
- **Account Deletion and Recovery Flow** — docs_auth_account_deletion_tombstone, docs_auth_finishdeletion, app_readme_route_guard, server_readme_account_deletion, docs_auth_user_tables_test [INFERRED 0.85]

## Communities (128 total, 14 thin omitted)

### Community 0 - "export.spec.ts"
Cohesion: 0.08
Nodes (40): express, jose, supertest, createVerifier(), createPool(), pool, createMemoryImageStore(), GIF (+32 more)

### Community 1 - ".execute"
Cohesion: 0.09
Nodes (58): deleteAllRows(), exportAllRows(), create(), duplicateNameAsValidation(), get(), remove(), update(), set() (+50 more)

### Community 2 - "SQL Driver & Test DB"
Cohesion: 0.10
Nodes (16): QueryResult, SqlDriver, owner, createPgDriver(), toPg(), bootstrapUser(), DEFAULT_CATEGORIES, pool (+8 more)

### Community 3 - "Security Workflow"
Cohesion: 0.05
Nodes (46): name, permissions, runs-on, steps, name, runs-on, steps, strategy (+38 more)

### Community 4 - "E2E & A11y Tests"
Cohesion: 0.07
Nodes (34): PUBLIC_ROUTES, SIGNED_IN_ROUTES, THEMES, WCAG_TAGS, deleteUsers(), APP_ROOT, ENV_FILE, loadE2eEnv() (+26 more)

### Community 5 - "StreakHeatmap.svelte"
Cohesion: 0.12
Nodes (10): Props, { streaks, class: className = '' }, top, CELL_CLASSES, { cells }, Props, cadence, { card, busy = false, onToggle } (+2 more)

### Community 6 - "CalendarView.svelte"
Cohesion: 0.14
Nodes (32): addDays(), compareDates(), fromUtcDate(), toUtcDate(), weekdayOf(), expectedDays(), isExpectedOn(), stateOf() (+24 more)

### Community 7 - "DashboardTasksToday.svelte"
Cohesion: 0.05
Nodes (38): GOAL_STATUSES, TASK_STATUSES, columns, empty, Filter, filter, finished, goalTitle (+30 more)

### Community 8 - "Global Constraints"
Cohesion: 0.22
Nodes (15): listCategories(), getGoal(), listGoals(), listStreaks(), listSubgoals(), listTasks(), GoalStatus, load() (+7 more)

### Community 9 - "db/repo/streak.ts"
Cohesion: 0.05
Nodes (31): { open, title, onClose }, phrase, PHRASES, Props, buttons, celebrating, confirmingArchive, current (+23 more)

### Community 10 - "with"
Cohesion: 0.05
Nodes (36): activeStatus, busy, clearFilters(), closeMoveMenu(), columns, dragOverStatus, drop(), due (+28 more)

### Community 11 - "server/package.json"
Cohesion: 0.06
Nodes (39): esbuild, tsx, @types/express, @types/multer, @types/pg, @types/supertest, devDependencies, esbuild@^0.28.2 (+31 more)

### Community 12 - "app.ts"
Cohesion: 0.05
Nodes (43): apiVersion, name, image, imagePullPolicy, livenessProbe, name, ports, readinessProbe (+35 more)

### Community 13 - "ideas/+page.svelte"
Cohesion: 0.05
Nodes (28): activeDay, busy, byDay, closeDay(), dayPanel, dayPanelClose, dayPanelLeft, dayPanelTop (+20 more)

### Community 14 - "ui.ts"
Cohesion: 0.18
Nodes (5): dayDots(), defaultSelectedDay(), DOTS_SHOWN, DotTone, dotTone()

### Community 16 - "api/types.ts"
Cohesion: 0.09
Nodes (23): createTask(), deleteTask(), setTaskStatus(), updateTask(), CellState, DayCell, GOAL_STATUS_LABELS, Idea (+15 more)

### Community 17 - "Goal Detail Page"
Cohesion: 0.07
Nodes (27): accent, actionError, addDirectTask(), addSubgoal(), boardTasks, busy, confirmingDelete, { data } (+19 more)

### Community 18 - "ImageSlot"
Cohesion: 0.11
Nodes (20): exportAccount(), setAvatar(), ErrorKind, UNREACHABLE_MESSAGE, configured, configureHttp(), HttpOptions, Method (+12 more)

### Community 19 - "vision-board/+page.svelte"
Cohesion: 0.06
Nodes (26): { items, class: className = '' }, preview, Props, Props, { src, alt = '', class: className = '' }, contentMissing, error, fileInput (+18 more)

### Community 20 - "GoalStatusSegment.svelte"
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
Cohesion: 0.15
Nodes (25): average(), countsTowardProgress(), goalProgress(), subgoalProgress(), taskCompletion(), fromIdeaIds(), getDetail(), GoalRow (+17 more)

### Community 22 - "Phase 1 API Plan"
Cohesion: 0.14
Nodes (26): JSON Error Format {kind, message}, Phase 1 API Server Implementation Plan, authenticate middleware, bootstrapUser with pg_advisory_xact_lock, createApp / Deps, createMemoryImageStore, createPgDriver / toPg (?N to $N), createPool (pg Pool, bigint as number) (+18 more)

### Community 23 - "CommandPalette.svelte"
Cohesion: 0.10
Nodes (21): Task, active, choose(), data, error, hits, input, KIND_LABEL (+13 more)

### Community 24 - "tasks/+page.svelte"
Cohesion: 0.06
Nodes (34): setStreakGraceDays(), otherTheme, Props, { showLabel = true }, tabId(), tabPanelId(), list, {
		tabs,
		value,
		onChange,
		id,
		label,
		class: className = ''
	} (+26 more)

### Community 25 - "app/package.json"
Cohesion: 0.07
Nodes (39): Handle, categoriesRouter(), ownGoalInput(), ideasRouter(), settingsRouter(), streaksRouter(), subgoalsRouter(), tasksRouter() (+31 more)

### Community 26 - "welcome/+page.svelte"
Cohesion: 0.16
Nodes (10): announcement, board, dragId, dragOverId, drop(), { items, busy, onReorder, onEdit, onDelete, onAddNew }, Props, step() (+2 more)

### Community 27 - "app.ts"
Cohesion: 0.13
Nodes (27): multer, pg, multer@^2.5.0, pg@^8.23.1, createApp(), Deps, Verifier, AuthAdmin (+19 more)

### Community 28 - "Self-review notes"
Cohesion: 0.12
Nodes (17): sharp, sharp@^0.35.5, AppError, ErrorKind, jpegWithGps(), solid(), ascii(), AVATAR_SIZE (+9 more)

### Community 29 - "VisionItemDrawer.svelte"
Cohesion: 0.08
Nodes (28): removeAvatar(), busy, clearAvatar(), confirmPassword, currentPassword, deleteConfirmed, deleteOpen, deleteTyped (+20 more)

### Community 30 - "request"
Cohesion: 0.12
Nodes (25): createCategory(), deleteCategory(), updateCategory(), createGoal(), deleteGoal(), setGoalStatus(), updateGoal(), request() (+17 more)

### Community 31 - "tauri.conf.json"
Cohesion: 0.07
Nodes (28): apiVersion, command, env, image, imagePullPolicy, name, resources, securityContext (+20 more)

### Community 32 - "Phase 2 Web Client Plan"
Cohesion: 0.20
Nodes (19): Phase 2 Web Client Implementation Plan, account.ts getProfile / setUsername / deleteAccount, AccountSettings.svelte and SidebarUser.svelte, Client AppError / ErrorKind (adds unauthenticated), AuthAdmin / createSupabaseAuthAdmin, DELETE /api/account route, deleteAllRows account repo, deleted_users tombstone (0004_deleted_users.sql) (+11 more)

### Community 33 - "TaskRow.svelte"
Cohesion: 0.19
Nodes (14): Goal, GoalSummary, Subgoal, SubgoalDetail, buildUpcomingFeed(), DashboardStats, dashboardStats(), baseGoal (+6 more)

### Community 34 - "Bug Log & App Shell"
Cohesion: 0.13
Nodes (17): SvelteKit App HTML Shell (app.html), Bug Log, Goal Status Change Feedback (archive confirm, completion celebration), Orphaned Tasks on Goal Delete (fixed: prompt user), Subgoal Delete Confirmation, Mushpoint (root README), Data Model (goals, subgoals, tasks, ideas, vision_items, deleted_users...), Retired Desktop App (Tauri + SQLite, tag desktop-sqlite-final) (+9 more)

### Community 35 - "tasks/+page.svelte"
Cohesion: 0.05
Nodes (40): done, pendingDone, Props, serverDone, { task, onMutated, onError, onDone }, toggle(), apply(), confirmArchive() (+32 more)

### Community 36 - "layout.spec.ts"
Cohesion: 0.14
Nodes (15): isPublicRoute(), PUBLIC_ROUTES, safeNext(), EMAIL_NOT_CONFIRMED, signIn(), bare, busy, deleted (+7 more)

### Community 37 - "db/repo/task.ts"
Cohesion: 0.20
Nodes (14): Recurrence, shiftYear(), DAYS, tasksByDay(), changeYear(), addDays(), fromUtcDate(), isExpectedOn() (+6 more)

### Community 38 - "Project Docs & TODO"
Cohesion: 0.12
Nodes (16): Themes via mushpoint-design CSS Custom Properties, Legibility Floor (WCAG 2 AA + APCA Lc thresholds), Future Cloud Deployment (phase 4), Planned Local Kubernetes kind Cluster (phase 3), Themes (nocturne, coquette) from mushpoint-design, Production Readiness TODO, CI Pipeline (GitHub Actions, Dependabot, npm audit), Data Safety (backups, PITR, restore drill) (+8 more)

### Community 39 - "listGoals"
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

### Community 42 - "Screens"
Cohesion: 0.06
Nodes (23): error, form, { open, idea = null, onClose, onSaved }, Props, shake, submitting, titleMissing, actionError (+15 more)

### Community 43 - "TaskListView.svelte"
Cohesion: 0.12
Nodes (15): columns, counts, empty, fullLine(), goalOf(), goalTitle, options, Props (+7 more)

### Community 44 - "prettier@^3.8.1"
Cohesion: 0.15
Nodes (15): express-rate-limit, zod, dependencies, express@^5.3.0, express-rate-limit@^8.7.4, jose@^6.2.15, zod@^4.6.7, buildOpenApi() (+7 more)

### Community 45 - "createExternalModules"
Cohesion: 0.08
Nodes (22): Adding CD later, Branch flow, CI/CD pipeline, `ci.yml`: does it build and work, Dependabot, Secrets, `security.yml`: is it safe to ship, What deploys (+14 more)

### Community 46 - "Auth Init & Profile"
Cohesion: 0.22
Nodes (16): deleteAccount(), getProfile(), Profile, getAccessToken(), signOut(), removeAccount(), leave(), leave() (+8 more)

### Community 47 - "TaskSummary"
Cohesion: 0.22
Nodes (12): TaskStatus, TaskSummary, shownColumn(), GoalStats, goalStats(), taskColumn(), displayColumn(), filterTasks() (+4 more)

### Community 49 - "Runtime Config"
Cohesion: 0.13
Nodes (10): AppError, config, FakeSession, supabase, AppConfig, fetchConfig(), FIELDS, loadConfig() (+2 more)

### Community 50 - "App TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, allowJs, checkJs, esModuleInterop, forceConsistentCasingInFileNames, moduleResolution, resolveJsonModule, rewriteRelativeImportExtensions (+5 more)

### Community 51 - "Hosted Roadmap"
Cohesion: 0.18
Nodes (12): Hosted Mushpoint Roadmap Plan (phases 1-3), bootstrapUser default categories and settings, Ingress single origin (/ web, /api API, limit-rps), Kubernetes Manifests, kind Cluster and Runbook (Task 16), Migration Kubernetes Job using API image, Roadmap Review Focus (isolation, auth, bootstrap, tz, images), withUser per-request transaction scope, Server Dockerfile (node:24-slim multi-stage) (+4 more)

### Community 52 - "MobileMenuSheet.svelte"
Cohesion: 0.09
Nodes (16): auth, leaving, { open, username, avatarUrl, settingsCurrent, onClose }, panel, Props, NavItem, { open, items, isCurrent, onToggle, username, avatarUrl }, Props (+8 more)

### Community 53 - "Auth Flow Docs"
Cohesion: 0.20
Nodes (10): PKCE Email Callback (/auth/callback), Root Layout Route Guard (+layout.ts), How Sign-In and Data Access Work (auth.md), completeCallback(), finishDeletion(), getAccessToken(), onUnauthenticated() 401 Callback, request() in app/src/lib/api/http.ts (+2 more)

### Community 54 - "SubgoalCard.svelte"
Cohesion: 0.15
Nodes (13): GoalDetail, chart, { goal }, Props, compareDates(), dayNumber(), earliest(), GanttChart (+5 more)

### Community 55 - "UI redesign: flat surface, dense rows"
Cohesion: 0.13
Nodes (14): 1. Tokens (kit `css/theme.css`), 2. Primitives (kit `svelte/` + `utils/ui.ts`), 3. Shell (`app/src/routes/+layout.svelte` and `components/shell`), 4. Screens (one PR each, in this order), 5. Reference-to-Mushpoint mapping, Approaches considered, Calls I made (flag any you disagree with), Constraints (+6 more)

### Community 56 - "kanban.ts"
Cohesion: 0.24
Nodes (10): dueTone(), DueFilter, filterTasks(), groupByStatus(), moveTargets(), NO_FILTER, PAGE_SIZE, pageOf() (+2 more)

### Community 57 - "Custom Select & Date Picker — Design"
Cohesion: 0.05
Nodes (36): Category, colorOf, columns, { goals, categories, class: className = '' }, Props, { goals, subgoals, tasks, class: className = '' }, KIND_LABELS, Props (+28 more)

### Community 58 - "Hosted Server Design"
Cohesion: 0.21
Nodes (7): mushpoint_app non-owner Postgres role, 0001_init.sql schema with RLS, Hosted Mushpoint Design Spec, Express 5 API Server on Node, Supabase JWKS Token Verification, Private Bucket Images via Signed URLs, Supabase (Postgres, auth, storage)

### Community 59 - "Docker Compose DB"
Cohesion: 0.15
Nodes (12): environment, healthcheck, image, ports, POSTGRES_PASSWORD, interval, retries, test (+4 more)

### Community 60 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, @axe-core/playwright@^4.14.0, prettier-plugin-svelte@^3.5.1, prettier-plugin-tailwindcss@^0.7.2, svelte@^5.55.2, @sveltejs/adapter-auto@^7.0.1, typescript@^6.0.2, vite@^8.3.8 (+6 more)

### Community 61 - "App Scripts"
Cohesion: 0.17
Nodes (12): scripts, build, check, check:watch, dev, format, lint, prepare (+4 more)

### Community 62 - "welcome/+page.svelte"
Cohesion: 0.20
Nodes (10): setUsername(), USERNAME_PATTERN, saveProfile(), busy, error, leave(), leaving, saving (+2 more)

### Community 63 - "Phase 2 Design Spec"
Cohesion: 0.18
Nodes (8): optimistic() helper with per-key sequencing, Two-user Playwright E2E with admin-created users, Phase 2 Web Client Design Spec, Delete Account Flow (storage, rows, auth user), Phase 2 Risks (Supabase pause, signed URL expiry), Supabase Browser Auth (PKCE, localStorage session), Unique Usernames via profiles table, Vite /api Proxy (no CORS)

### Community 64 - "+layout.svelte"
Cohesion: 0.07
Nodes (23): failedUrl, initial, { name, url, class: sizing = 'size-8 text-sm' }, Props, showImage, { name, avatarUrl, menuOpen, onMenu, menuButton = $bindable() }, Props, { crumbs, onSearch, name, avatarUrl, searchButton = $bindable() } (+15 more)

### Community 65 - "dependencies"
Cohesion: 0.17
Nodes (12): dependencies, mushpoint-design@git+https://github.com/Vu1nea/Mushpoi..., @supabase/auth-js@^2.119.0, @sveltejs/vite-plugin-svelte@^7.0.0, tailwindcss@^4.2.2, name, private, type (+4 more)

### Community 66 - "CI Concurrency"
Cohesion: 0.18
Nodes (10): concurrency, cancel-in-progress, group, name, on, pull_request, push, permissions (+2 more)

### Community 67 - "Server TS Config"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, skipLibCheck, strict, target (+2 more)

### Community 68 - "signup/+page.svelte"
Cohesion: 0.20
Nodes (8): { children }, busy, confirm, email, error, password, resent, sent

### Community 69 - "Server Design Docs"
Cohesion: 0.29
Nodes (6): createVerifier() JWT Verifier (jose, ES256/RS256), Additive Migrations 0001-0005, Mushpoint API Server README, API Container Image (node:24-slim, migrateCli), Live Smoke Test Results 2026-11-08, Supabase Setup (asymmetric JWT keys, private vision bucket 5 MB)

### Community 70 - "Dependabot"
Cohesion: 0.18
Nodes (10): dependency-type, dev-dependencies, interval, updates, directory, groups, package-ecosystem, schedule (+2 more)

### Community 71 - "routes/visionItems.ts"
Cohesion: 0.27
Nodes (8): Ctx, isOwnImagePath(), goalsRouter(), ownInput(), visionItemsRouter(), visionItemInput, VisionItem, VisionItemView

### Community 72 - "MobileQuickAdd.svelte"
Cohesion: 0.07
Nodes (21): kind, KINDS, { onAdded, onError, class: className = '', stacked = false }, Props, QuickAddKind, submit(), submitting, title (+13 more)

### Community 73 - "Mushpoint"
Cohesion: 0.40
Nodes (4): Branch flow, Commands, Mushpoint, Rules that are easy to break

### Community 74 - "CI Job Env"
Cohesion: 0.29
Nodes (7): defaults, env, name, runs-on, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, app, env

### Community 75 - "src/types.ts"
Cohesion: 0.06
Nodes (30): CategoryRow, list(), map(), ProfileRow, StoredProfile, SettingsRow, THEMES, Category (+22 more)

### Community 76 - "RLS as Isolation Boundary"
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

### Community 85 - "Architecture decisions"
Cohesion: 0.50
Nodes (4): 1. Own API in front of Postgres, rather than Supabase alone, 2. Supabase-hosted Postgres, rather than self-hosted, 3. One flat sheet instead of nested cards, Architecture decisions

### Community 86 - "SvelteKit Static Adapter"
Cohesion: 0.40
Nodes (3): @sveltejs/adapter-static@^3.0.11, config, @sveltejs/adapter-static

### Community 87 - "goals/+page.ts"
Cohesion: 0.10
Nodes (14): KEPT, USER_TABLES, A, authAdmin, B, C, D, E (+6 more)

### Community 88 - "logger.ts"
Cohesion: 0.19
Nodes (6): pino, pino@^10.4.0, createLogger(), Closable, shutdown(), logger

### Community 89 - "CI E2E Secrets"
Cohesion: 0.40
Nodes (5): E2E_PASSWORD, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL, env

### Community 90 - "+layout.ts"
Cohesion: 0.06
Nodes (20): error, form, Props, { subgoal, onClose, onSaved }, submitting, titleMissing, Props, { title, subtitle, actions } (+12 more)

### Community 91 - "Web-only Cutover"
Cohesion: 0.50
Nodes (3): MUSHPOINT_TARGET=web Build Target, Web-only cutover (delete Tauri/SQLite), SQLite to Postgres Port of Repos

### Community 92 - "vitest@^4.1.3"
Cohesion: 0.12
Nodes (29): AuthState, CallbackResult, callbackUrl(), changeEmail(), changePassword(), check(), completeCallback(), createAuthClient() (+21 more)

### Community 94 - "build.rs"
Cohesion: 0.10
Nodes (18): Changes, Children, How long we keep it, Mushpoint privacy policy, Storage on your device, What we hold, Who else handles your data, Why we hold it (lawful basis) (+10 more)

### Community 95 - "main.rs"
Cohesion: 0.13
Nodes (18): buildPostman(), CAPTURED, Folder, FOLDERS, goalBody, item(), Method, OPEN (+10 more)

### Community 96 - "mockup-next-steps.md"
Cohesion: 0.29
Nodes (3): A, app, B

### Community 97 - "post-checkout"
Cohesion: 0.11
Nodes (17): nginx.ingress.kubernetes.io/limit-burst-multiplier, nginx.ingress.kubernetes.io/limit-rps, nginx.ingress.kubernetes.io/proxy-body-size, apiVersion, paths, kind, metadata, annotations (+9 more)

### Community 102 - "app"
Cohesion: 0.29
Nodes (4): @sveltejs/kit@^2.70.4, @tailwindcss/vite@^4.2.2, @sveltejs/kit, @tailwindcss/vite

### Community 103 - "api/settings.ts"
Cohesion: 0.47
Nodes (4): getSettings(), setActiveTheme(), Settings, load()

### Community 105 - "By chapter"
Cohesion: 0.13
Nodes (15): By chapter, Gaps to act on, Not applicable at Level 1, OWASP ASVS 4.0.3 Level 1 walk, V10 Malicious code, V11 Business logic, V12 Files and resources, V13 API (+7 more)

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

### Community 115 - "api/visionItems.ts"
Cohesion: 0.16
Nodes (8): VisionItem, VisionItemInput, VisionItemView, createVisionItem(), deleteVisionItem(), listVisionItems(), updateVisionItem(), load()

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
Cohesion: 0.22
Nodes (10): { items, isCurrent }, Props, markup, { name, size = 20, label, weight = 1.8, class: className = '' }, Props, AppIconName, appIcons, iconMarkup() (+2 more)

### Community 124 - "main.ts"
Cohesion: 0.13
Nodes (17): createMemoryAuthAdmin(), createSupabaseAuthAdmin(), Config, loadConfig(), REQUIRED, base, createSupabaseImageStore(), authAdmin (+9 more)

## Knowledge Gaps
- **44 isolated node(s):** `RFC-3339`, `./.svelte-kit/tsconfig.json`, `RFC-3339`, `robots.txt (allow all crawling)`, `Wrench Icon SVG` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1162 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `By chapter` connect `By chapter` to `Custom Select & Date Picker — Design`, `vitest@^4.1.3`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `request()` (e.g. with `index.spec.ts` and `lib/images.spec.ts`) actually correct?**
  _`request()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-3339`, `./.svelte-kit/tsconfig.json`, `RFC-3339` to the rest of the system?**
  _44 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `export.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07909604519774012 - nodes in this community are weakly interconnected._
- **Why does `OWASP ASVS 4.0.3 Level 1 walk` connect `By chapter` to `Auth Flow Docs`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Should `.execute` be split into smaller, more focused modules?**
  _Cohesion score 0.08509615384615385 - nodes in this community are weakly interconnected._
- **Why does `How Sign-In and Data Access Work (auth.md)` connect `Auth Flow Docs` to `Bug Log & App Shell`, `Server Design Docs`, `Project Docs & TODO`, `RLS as Isolation Boundary`, `Web Client README`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._