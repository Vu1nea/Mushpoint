# Graph Report - Mushpoint  (2026-11-20)

## Corpus Check
- 255 files · ~117,609 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 10, .example 2, .conf 2)

## Summary
- 1883 nodes · 4206 edges · 106 communities (93 shown, 13 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 138 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2fe6d168`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- API Route & IDOR Tests
- Repo Row Mapping
- SQL Driver & Test DB
- Security Workflow
- E2E & A11y Tests
- ui.ts
- repo/streak.ts
- Auth Session & Callback
- listCategories
- Goal Status & Dialogs
- Kanban Board
- devDependencies
- FormModal.svelte
- Calendar View
- Account Settings
- UI Primitives
- Web API Types
- Goal Detail Page
- request
- Ideas Page & Drawer
- TaskDrawer.svelte
- Goal Progress Logic
- Phase 1 API Plan
- Task Manager Page & Tabs
- Categories Settings
- schemas.ts
- Vision Board Grid
- app.ts
- Logging, Pool & Shutdown
- TaskRow.svelte
- Calendar Grid & Gantt View
- Spinner.svelte
- Phase 2 Web Client Plan
- src/types.ts
- Bug Log & App Shell
- Icon.svelte
- Route Guards
- Date Picker Calendar
- Project Docs & TODO
- Goal Drawer
- listCategories
- CI Steps
- ideas/+page.svelte
- SubgoalCard.svelte
- mush-icon.png (Mushpoint app icon)
- MobileMenuSheet.svelte
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
- ref_app
- Hosted Server Design
- Docker Compose DB
- App Dev Dependencies
- App Scripts
- server/package.json
- Phase 2 Design Spec
- Server Image Store
- App Runtime Dependencies
- CI Concurrency
- Server TS Config
- kanban.ts
- Server Design Docs
- Dependabot
- Server Runtime Dependencies
- dashboard.ts
- openapi.spec.ts
- CI Job Env
- AppError
- RLS & Request Lifecycle Docs
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
- Tabs.svelte
- CI E2E Secrets
- Brand Mascot
- Web-only Cutover
- Prettier
- visionItem.ts
- repo/settings.ts
- Mushpoint
- StreakCard.svelte
- VisionBoard.spec.ts
- App Types
- Robots.txt
- Wrench Icon
- @sveltejs/kit
- typescript@^6.0.2
- vite@^8.3.8
- vitest@^4.1.12

## God Nodes (most connected - your core abstractions)
1. `request()` - 53 edges
2. `svelte` - 34 edges
3. `AppError` - 33 edges
4. `nowIso()` - 31 edges
5. `Phase 1 API Server Implementation Plan` - 30 edges
6. `Mushpoint (root README)` - 29 edges
7. `SqlDriver` - 28 edges
8. `AppError` - 27 edges
9. `createApp()` - 26 edges
10. `express` - 24 edges

## Surprising Connections (you probably didn't know these)
- `Rules that are easy to break` --references--> `isOwnImagePath()`  [INFERRED]
  CLAUDE.md → server/src/images.ts
- `Placeholder Conventions (snake_case, your_access_token_here)` --conceptually_related_to--> `Mushpoint (root README)`  [INFERRED]
  .claude/skills/vercel-writing-guidelines/SKILL.md → README.md
- `Server Account Deletion (4 idempotent steps)` --semantically_similar_to--> `Account Deletion with deleted_users Tombstone`  [INFERRED] [semantically similar]
  server/README.md → docs/auth.md
- `SvelteKit App HTML Shell (app.html)` --implements--> `SvelteKit SPA Client (app/)`  [INFERRED]
  app/src/app.html → README.md
- `Orphaned Tasks on Goal Delete (fixed: prompt user)` --references--> `Data Model (goals, subgoals, tasks, ideas, vision_items, deleted_users...)`  [INFERRED]
  docs/BUG-LOG.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Browser-to-API Authenticated Request Flow** — docs_auth_getaccesstoken, docs_auth_request, docs_auth_createverifier, docs_auth_withuser, docs_auth_own_rows_policy [EXTRACTED 1.00]
- **Production Security Hardening** — todo_rate_limiting, todo_idor_sweep, todo_security_scanning, todo_web_csp_headers, todo_zod_validation [EXTRACTED 1.00]
- **Account deletion flow (images, rows, auth user, tombstone)** — docs_superpowers_plans_2026_11_08_phase_2_web_client_delete_account_route, docs_superpowers_plans_2026_11_08_phase_2_web_client_removeallfor, docs_superpowers_plans_2026_11_08_phase_2_web_client_deleteallrows, docs_superpowers_plans_2026_11_08_phase_2_web_client_authadmin, docs_superpowers_plans_2026_11_08_phase_2_web_client_deleted_users_tombstone [EXTRACTED 1.00]
- **Per-request user isolation flow (verify token, set app.user_id, RLS)** — docs_superpowers_plans_2026_11_06_phase_1_api_server_authenticate, docs_superpowers_plans_2026_11_06_phase_1_api_server_createverifier, docs_superpowers_plans_2026_11_06_phase_1_api_server_makehandle, docs_superpowers_plans_2026_11_06_phase_1_api_server_withuser, docs_superpowers_plans_2026_11_06_phase_1_api_server_0001_init_sql [EXTRACTED 1.00]
- **Account Deletion and Recovery Flow** — docs_auth_account_deletion_tombstone, docs_auth_finishdeletion, app_readme_route_guard, server_readme_account_deletion, docs_auth_user_tables_test [INFERRED 0.85]
- **** — app_src_lib_assets_mush_icon, app_src_lib_assets_mush_icon_cow_mascot, app_src_lib_assets_mush_icon_warm_earthy_palette, app_src_lib_assets_mush_icon_mushpoint_brand [INFERRED 0.85]

## Communities (106 total, 13 thin omitted)

### Community 0 - "API Route & IDOR Tests"
Cohesion: 0.08
Nodes (37): express, jose, supertest, createVerifier(), createMemoryAuthAdmin(), createMemoryImageStore(), pool, USER (+29 more)

### Community 1 - "Repo Row Mapping"
Cohesion: 0.14
Nodes (36): deleteAllRows(), CategoryRow, create(), duplicateNameAsValidation(), get(), list(), map(), remove() (+28 more)

### Community 2 - "SQL Driver & Test DB"
Cohesion: 0.10
Nodes (16): QueryResult, SqlDriver, createPgDriver(), toPg(), bootstrapUser(), DEFAULT_CATEGORIES, pool, users (+8 more)

### Community 3 - "Security Workflow"
Cohesion: 0.05
Nodes (46): name, permissions, runs-on, steps, name, runs-on, steps, strategy (+38 more)

### Community 4 - "E2E & A11y Tests"
Cohesion: 0.07
Nodes (31): PUBLIC_ROUTES, SIGNED_IN_ROUTES, THEMES, WCAG_TAGS, deleteUsers(), APP_ROOT, ENV_FILE, loadE2eEnv() (+23 more)

### Community 5 - "ui.ts"
Cohesion: 0.06
Nodes (32): CellState, DayCell, delayByGoalId, { goals, categories, class: className = '' }, grouped, Props, { goals, subgoals, tasks, class: className = '' }, KIND_LABELS (+24 more)

### Community 6 - "repo/streak.ts"
Cohesion: 0.28
Nodes (15): addDays(), compareDates(), fromUtcDate(), toUtcDate(), weekdayOf(), expectedDays(), isExpectedOn(), stateOf() (+7 more)

### Community 7 - "Auth Session & Callback"
Cohesion: 0.10
Nodes (35): AuthState, CallbackResult, callbackUrl(), changeEmail(), changePassword(), check(), completeCallback(), getAccessToken() (+27 more)

### Community 8 - "listCategories"
Cohesion: 0.28
Nodes (11): getGoal(), listGoals(), listStreaks(), listSubgoals(), listTasks(), listVisionItems(), withQuery(), load() (+3 more)

### Community 9 - "Goal Status & Dialogs"
Cohesion: 0.13
Nodes (16): setGoalStatus(), apply(), buttons, celebrating, confirmArchive(), confirmingArchive, current, { goalId, title, status, progress, onMutated, onError } (+8 more)

### Community 10 - "Kanban Board"
Cohesion: 0.06
Nodes (31): activeStatus, busy, clearFilters(), closeMoveMenu(), columns, dragOverStatus, due, DUE_OPTIONS (+23 more)

### Community 11 - "devDependencies"
Cohesion: 0.12
Nodes (16): esbuild, tsx, @types/multer, @types/pg, @types/supertest, devDependencies, esbuild@^0.28.2, supertest@^7.3.1 (+8 more)

### Community 12 - "FormModal.svelte"
Cohesion: 0.09
Nodes (10): {
		open,
		title,
		body,
		confirmLabel = 'Delete',
		busy = false,
		busyLabel = 'Deleting…',
		disabled = false,
		onConfirm,
		onCancel,
		children
	}, Props, base, {
		open,
		title,
		submitLabel,
		submitting = false,
		error = null,
		onClose,
		onSubmit,
		children
	}, panel, Props, { open, title, onClose }, phrase (+2 more)

### Community 13 - "Calendar View"
Cohesion: 0.05
Nodes (29): updateTask(), activeDay, busy, byDay, closeDay(), dayPanel, dayPanelClose, dayPanelLeft (+21 more)

### Community 14 - "Account Settings"
Cohesion: 0.08
Nodes (23): busy, clearAvatar(), confirmPassword, currentPassword, deleteConfirmed, deleteOpen, deleteTyped, deleting (+15 more)

### Community 15 - "UI Primitives"
Cohesion: 0.10
Nodes (13): props, { value = $bindable(), ...rest }, props, Props, { value = $bindable(''), class: className = '', ...rest }, visible, props, props (+5 more)

### Community 16 - "Web API Types"
Cohesion: 0.11
Nodes (26): Category, CategoryInput, Goal, GOAL_STATUS_LABELS, GOAL_STATUSES, GoalDetail, GoalInput, GoalSummary (+18 more)

### Community 17 - "Goal Detail Page"
Cohesion: 0.08
Nodes (28): createSubgoal(), deleteGoal(), accent, actionError, addDirectTask(), addSubgoal(), boardTasks, busy (+20 more)

### Community 18 - "request"
Cohesion: 0.10
Nodes (26): deleteAccount(), getProfile(), removeAvatar(), setAvatar(), AppError, ErrorKind, UNREACHABLE_MESSAGE, configured (+18 more)

### Community 19 - "Ideas Page & Drawer"
Cohesion: 0.10
Nodes (20): createIdea(), createTask(), updateIdea(), kind, KINDS, { onAdded, onError, class: className = '' }, Props, QuickAddKind (+12 more)

### Community 20 - "TaskDrawer.svelte"
Cohesion: 0.13
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
Cohesion: 0.17
Nodes (22): average(), countsTowardProgress(), goalProgress(), subgoalProgress(), taskCompletion(), fromIdeaIds(), getDetail(), GoalRow (+14 more)

### Community 22 - "Phase 1 API Plan"
Cohesion: 0.14
Nodes (26): JSON Error Format {kind, message}, Phase 1 API Server Implementation Plan, authenticate middleware, bootstrapUser with pg_advisory_xact_lock, createApp / Deps, createMemoryImageStore, createPgDriver / toPg (?N to $N), createPool (pg Pool, bigint as number) (+18 more)

### Community 23 - "Task Manager Page & Tabs"
Cohesion: 0.13
Nodes (13): deleteTask(), actionError, busy, { data }, deletingTask, drawerOpen, editingTask, newTaskDue (+5 more)

### Community 24 - "Categories Settings"
Cohesion: 0.11
Nodes (20): createCategory(), deleteCategory(), updateCategory(), actionError, addCategory(), busy, { data }, deleting (+12 more)

### Community 25 - "schemas.ts"
Cohesion: 0.05
Nodes (57): createApp(), authenticate(), Ctx, errorHandler(), Handle, INTERNAL, logFor(), makeHandle() (+49 more)

### Community 26 - "Vision Board Grid"
Cohesion: 0.05
Nodes (37): createVisionItem(), deleteVisionItem(), updateVisionItem(), announcement, board, dragId, dragOverId, drop() (+29 more)

### Community 27 - "app.ts"
Cohesion: 0.18
Nodes (15): pg, Deps, Verifier, AuthAdmin, checkedUpload(), ImageStore, Limits, deleteAccount() (+7 more)

### Community 28 - "Logging, Pool & Shutdown"
Cohesion: 0.07
Nodes (25): Config, loadConfig(), REQUIRED, base, owner, createPool(), pool, A (+17 more)

### Community 29 - "TaskRow.svelte"
Cohesion: 0.13
Nodes (13): gridClass, { items, class: className = '' }, preview, Props, busy, confirmingDelete, done, pendingDone (+5 more)

### Community 30 - "Calendar Grid & Gantt View"
Cohesion: 0.20
Nodes (5): dayDots(), defaultSelectedDay(), DOTS_SHOWN, DotTone, dotTone()

### Community 31 - "Spinner.svelte"
Cohesion: 0.22
Nodes (7): Props, { size = 14, class: className = '' }, busy, email, error, sent, submit()

### Community 32 - "Phase 2 Web Client Plan"
Cohesion: 0.20
Nodes (19): Phase 2 Web Client Implementation Plan, account.ts getProfile / setUsername / deleteAccount, AccountSettings.svelte and SidebarUser.svelte, Client AppError / ErrorKind (adds unauthenticated), AuthAdmin / createSupabaseAuthAdmin, DELETE /api/account route, deleteAllRows account repo, deleted_users tombstone (0004_deleted_users.sql) (+11 more)

### Community 33 - "src/types.ts"
Cohesion: 0.10
Nodes (25): listRecurring(), map(), TaskRow, Category, CategoryInput, DayCell, GOAL_STATUS_LABELS, GOAL_STATUSES (+17 more)

### Community 34 - "Bug Log & App Shell"
Cohesion: 0.13
Nodes (17): SvelteKit App HTML Shell (app.html), Bug Log, Goal Status Change Feedback (archive confirm, completion celebration), Orphaned Tasks on Goal Delete (fixed: prompt user), Subgoal Delete Confirmation, Mushpoint (root README), Data Model (goals, subgoals, tasks, ideas, vision_items, deleted_users...), Retired Desktop App (Tauri + SQLite, tag desktop-sqlite-final) (+9 more)

### Community 35 - "Icon.svelte"
Cohesion: 0.22
Nodes (10): markup, { name, size = 20, label, weight = 1.8, class: className = '' }, Props, { items, isCurrent }, Props, AppIconName, appIcons, iconMarkup() (+2 more)

### Community 36 - "Route Guards"
Cohesion: 0.07
Nodes (25): isPublicRoute(), PUBLIC_ROUTES, safeNext(), EMAIL_NOT_CONFIRMED, bare, { children, data }, isCurrent(), MAIN_NAV (+17 more)

### Community 37 - "Date Picker Calendar"
Cohesion: 0.20
Nodes (14): Recurrence, shiftYear(), DAYS, tasksByDay(), changeYear(), addDays(), fromUtcDate(), isExpectedOn() (+6 more)

### Community 38 - "Project Docs & TODO"
Cohesion: 0.12
Nodes (16): Themes via mushpoint-design CSS Custom Properties, Legibility Floor (WCAG 2 AA + APCA Lc thresholds), Future Cloud Deployment (phase 4), Planned Local Kubernetes kind Cluster (phase 3), Themes (nocturne, coquette) from mushpoint-design, Production Readiness TODO, CI Pipeline (GitHub Actions, Dependabot, npm audit), Data Safety (backups, PITR, restore drill) (+8 more)

### Community 39 - "Goal Drawer"
Cohesion: 0.13
Nodes (12): createGoal(), updateGoal(), error, form, isValidUrl(), {
		open,
		categories,
		goal = null,
		prefill = null,
		create = createGoal,
		onClose,
		onSaved
	}, Props, shake (+4 more)

### Community 40 - "listCategories"
Cohesion: 0.22
Nodes (11): listCategories(), listIdeas(), listIdeaTags(), getSettings(), GoalStatus, GoalFilter, load(), readFilter() (+3 more)

### Community 41 - "CI Steps"
Cohesion: 0.18
Nodes (16): steps, steps, steps, steps, if, name, run, uses (+8 more)

### Community 42 - "ideas/+page.svelte"
Cohesion: 0.13
Nodes (15): deleteIdea(), promoteIdea(), actionError, addIdea(), busy, createPromotedGoal(), { data }, deletingIdea (+7 more)

### Community 43 - "SubgoalCard.svelte"
Cohesion: 0.18
Nodes (12): deleteSubgoal(), addTask(), busy, confirmingDelete, expanded, newTaskRecurrence, newTaskTitle, pendingComplete (+4 more)

### Community 44 - "mush-icon.png (Mushpoint app icon)"
Cohesion: 0.17
Nodes (11): mush-icon.png (Mushpoint app icon), Cow Mascot (brown calf face with curly tuft), Mushpoint Brand Identity, Warm Earthy Brand Palette (browns, salmon pink), failedUrl, initial, { name, url, class: sizing = 'size-8 text-sm' }, Props (+3 more)

### Community 45 - "MobileMenuSheet.svelte"
Cohesion: 0.10
Nodes (15): leaving, { open, username, avatarUrl, settingsCurrent, onClose }, panel, Props, otherTheme, Props, { showLabel = true }, isTheme() (+7 more)

### Community 46 - "Auth Init & Profile"
Cohesion: 0.21
Nodes (15): Profile, initAuth(), signOut(), removeAccount(), leave(), leave(), finishDeletion(), LayoutData (+7 more)

### Community 47 - "idea.ts"
Cohesion: 0.23
Nodes (11): get(), IdeaRow, listTags(), map(), mapTag(), promote(), promoteToNewGoal(), TagRow (+3 more)

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
Cohesion: 0.14
Nodes (16): setSubgoalComplete(), setTaskStatus(), drop(), moveTask(), quickAdd(), run(), step(), toggleComplete() (+8 more)

### Community 53 - "Auth Flow Docs"
Cohesion: 0.23
Nodes (10): PKCE Email Callback (/auth/callback), Root Layout Route Guard (+layout.ts), How Sign-In and Data Access Work (auth.md), completeCallback(), finishDeletion(), getAccessToken(), onUnauthenticated() 401 Callback, request() in app/src/lib/api/http.ts (+2 more)

### Community 54 - "gantt.ts"
Cohesion: 0.16
Nodes (12): chart, { goal }, Props, compareDates(), dayNumber(), earliest(), GanttChart, ganttChart() (+4 more)

### Community 55 - "welcome/+page.svelte"
Cohesion: 0.25
Nodes (8): setUsername(), USERNAME_PATTERN, busy, error, leaving, saving, submit(), username

### Community 56 - "SubgoalDrawer.svelte"
Cohesion: 0.22
Nodes (8): updateSubgoal(), error, form, Props, { subgoal, onClose, onSaved }, submit(), submitting, titleMissing

### Community 57 - "ref_app"
Cohesion: 0.14
Nodes (10): auth, busy, name, { open, username, avatarUrl, current = false }, Props, row, notFound, title (+2 more)

### Community 58 - "Hosted Server Design"
Cohesion: 0.21
Nodes (7): mushpoint_app non-owner Postgres role, 0001_init.sql schema with RLS, Hosted Mushpoint Design Spec, Express 5 API Server on Node, Supabase JWKS Token Verification, Private Bucket Images via Signed URLs, Supabase (Postgres, auth, storage)

### Community 59 - "Docker Compose DB"
Cohesion: 0.15
Nodes (12): environment, healthcheck, image, ports, POSTGRES_PASSWORD, interval, retries, test (+4 more)

### Community 60 - "App Dev Dependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @axe-core/playwright@^4.14.0, prettier-plugin-svelte@^3.5.1, prettier-plugin-tailwindcss@^0.7.2, svelte@^5.55.2, svelte-check@^4.4.6, @sveltejs/vite-plugin-svelte@^7.0.0, tailwindcss@^4.2.2 (+5 more)

### Community 61 - "App Scripts"
Cohesion: 0.17
Nodes (12): scripts, build, check, check:watch, dev, format, lint, prepare (+4 more)

### Community 62 - "server/package.json"
Cohesion: 0.15
Nodes (12): @types/express, @types/express@^5.0.6, vitest@^5.1.0, directories, test, engines, node, vitest (+4 more)

### Community 63 - "Phase 2 Design Spec"
Cohesion: 0.18
Nodes (8): optimistic() helper with per-key sequencing, Two-user Playwright E2E with admin-created users, Phase 2 Web Client Design Spec, Delete Account Flow (storage, rows, auth user), Phase 2 Risks (Supabase pause, signed URL expiry), Supabase Browser Auth (PKCE, localStorage session), Unique Usernames via profiles table, Vite /api Proxy (no CORS)

### Community 64 - "Server Image Store"
Cohesion: 0.20
Nodes (12): createSupabaseAuthAdmin(), ascii(), createSupabaseImageStore(), EXTENSIONS, ImageType, sniffImageType(), GIF, JPEG (+4 more)

### Community 65 - "App Runtime Dependencies"
Cohesion: 0.17
Nodes (12): dependencies, mushpoint-design@git+https://github.com/Vu1nea/Mushpoi..., @supabase/supabase-js@^2.119.0, @sveltejs/adapter-auto@^7.0.1, @types/node@^24.13.3, @types/node, name, private (+4 more)

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
Cohesion: 0.20
Nodes (8): createVerifier() JWT Verifier (jose, ES256/RS256), Error Shape { kind, message }, Additive Migrations 0001-0005, Mushpoint API Server README, API Container Image (node:24-slim, migrateCli), API Conventions (/api base, bearer auth, X-Timezone, error shape), Live Smoke Test Results 2026-11-08, Supabase Setup (asymmetric JWT keys, private vision bucket 5 MB)

### Community 70 - "Dependabot"
Cohesion: 0.20
Nodes (9): dependency-type, dev-dependencies, interval, updates, directory, groups, package-ecosystem, schedule (+1 more)

### Community 71 - "Server Runtime Dependencies"
Cohesion: 0.17
Nodes (12): express-rate-limit, multer, pino, zod, dependencies, express@^5.3.0, express-rate-limit@^8.7.4, jose@^6.2.15 (+4 more)

### Community 72 - "dashboard.ts"
Cohesion: 0.11
Nodes (18): StreakCard, Subgoal, SubgoalDetail, Props, { streaks, class: className = '' }, top, Props, { tasks, onMutated, onError, class: className = '' } (+10 more)

### Community 73 - "openapi.spec.ts"
Cohesion: 0.29
Nodes (8): buildOpenApi(), error(), json(), Method, Op, operation(), OPERATIONS, out

### Community 74 - "CI Job Env"
Cohesion: 0.22
Nodes (9): env, name, runs-on, name, runs-on, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, jobs, app (+1 more)

### Community 75 - "AppError"
Cohesion: 0.11
Nodes (21): AppError, ErrorKind, localDateOf(), MAX_TEXT, optionalUrl(), parseDateOrThrow(), parseTimezone(), today() (+13 more)

### Community 76 - "RLS & Request Lifecycle Docs"
Cohesion: 0.25
Nodes (6): own_rows RLS Policy (FORCE ROW LEVEL SECURITY), withUser() Transaction Scope, First-Request Bootstrap (settings + 5 default categories, advisory lock), mushpoint_app Role (NOBYPASSRLS), API Request Lifecycle (authenticate, withUser tx, afterCommit, errorHandler), IDOR Sweep Test (23 id-taking routes)

### Community 77 - "Mobile Responsive Plan"
Cohesion: 0.25
Nodes (7): Bottom tab bar + top bar + menu sheet on phones, FormModal as bottom sheet below md, KanbanBoard one column at a time via Tabs on mobile, Mobile-first with md (768px) shell breakpoint, Playwright iPhone 13 / Pixel 7 projects + no-overflow check, Mobile responsiveness plan, Touch affordances (pointer-coarse, 40px hit areas, 16px inputs)

### Community 78 - "CI Defaults"
Cohesion: 0.25
Nodes (8): defaults, run, server, working-directory, defaults, name, runs-on, services

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
Cohesion: 0.33
Nodes (6): env, name, needs, runs-on, HAS_SECRETS, e2e

### Community 85 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, check, db:down, db:up, dev, migrate, openapi (+2 more)

### Community 86 - "SvelteKit Static Adapter"
Cohesion: 0.40
Nodes (3): @sveltejs/adapter-static@^3.0.11, config, @sveltejs/adapter-static

### Community 88 - "Tabs.svelte"
Cohesion: 0.31
Nodes (5): tabId(), tabPanelId(), list, {
		tabs,
		value,
		onChange,
		id,
		label,
		class: className = ''
	}, panel()

### Community 89 - "CI E2E Secrets"
Cohesion: 0.40
Nodes (5): E2E_PASSWORD, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL, env

### Community 90 - "Brand Mascot"
Cohesion: 0.50
Nodes (3): mush_img.png (Mushpoint cow mascot), Brown Calf Mascot Illustration, Mushpoint Brand Identity

### Community 91 - "Web-only Cutover"
Cohesion: 0.50
Nodes (3): MUSHPOINT_TARGET=web Build Target, Web-only cutover (delete Tauri/SQLite), SQLite to Postgres Port of Repos

### Community 93 - "visionItem.ts"
Cohesion: 0.36
Nodes (8): create(), get(), list(), map(), reorder(), requireContent(), update(), VisionItemRow

### Community 94 - "repo/settings.ts"
Cohesion: 0.28
Nodes (6): get(), setGraceDays(), setTheme(), SettingsRow, THEMES, Settings

### Community 95 - "Mushpoint"
Cohesion: 0.50
Nodes (3): Commands, Mushpoint, Rules that are easy to break

### Community 96 - "StreakCard.svelte"
Cohesion: 0.33
Nodes (3): cadence, { card, busy = false, onToggle }, Props

### Community 102 - "@sveltejs/kit"
Cohesion: 0.40
Nodes (4): @sveltejs/kit@^2.70.4, @tailwindcss/vite@^4.2.2, @sveltejs/kit, @tailwindcss/vite

## Knowledge Gaps
- **46 isolated node(s):** `RFC-3339`, `./.svelte-kit/tsconfig.json`, `RFC-3339`, `robots.txt (allow all crawling)`, `Wrench Icon SVG` (+41 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 818 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `svelte` connect `UI Primitives` to `App Runtime Dependencies`, `VisionBoard.spec.ts`, `Route Guards`, `Goal Drawer`, `Auth Session & Callback`, `Goal Status & Dialogs`, `Kanban Board`, `SubgoalCard.svelte`, `FormModal.svelte`, `Calendar View`, `MobileMenuSheet.svelte`, `Web API Types`, `Ideas Page & Drawer`, `TaskDrawer.svelte`, `SubgoalDrawer.svelte`, `Vision Board Grid`, `Tabs.svelte`, `App Dev Dependencies`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `request()` (e.g. with `index.spec.ts` and `lib/images.spec.ts`) actually correct?**
  _`request()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-3339`, `./.svelte-kit/tsconfig.json`, `RFC-3339` to the rest of the system?**
  _46 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Route & IDOR Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.07756813417190776 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `App Dev Dependencies` to `App Runtime Dependencies`, `E2E & A11y Tests`, `@sveltejs/kit`, `typescript@^6.0.2`, `vite@^8.3.8`, `vitest@^4.1.12`, `SvelteKit Static Adapter`, `Prettier`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `Repo Row Mapping` be split into smaller, more focused modules?**
  _Cohesion score 0.1423076923076923 - nodes in this community are weakly interconnected._
- **Why does `express` connect `API Route & IDOR Tests` to `Server Runtime Dependencies`, `schemas.ts`, `app.ts`, `Logging, Pool & Shutdown`, `server/package.json`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._