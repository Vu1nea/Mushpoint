# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the card-on-card look with one flat sheet on a canvas, dense rows, bare stats and a top bar, across every screen, in both themes, with rebuilt components.

**Architecture:** New tokens and primitives land first in the separate `mushpoint-design` repo (the kit). The app bumps its pinned kit commit, rebuilds the shell, then migrates one screen per PR into `dev`. Existing palettes are kept; the existing `background / surface / surface-raised / subtle` tokens already map to canvas / sheet / hover / hairline.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Tailwind v4, Vitest (SSR `render` from `svelte/server`), Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-11-21-ui-redesign-design.md`

## Global Constraints

- Keep the coquette (light) and nocturne (dark) palettes unchanged. Only one new colour token: `faint`.
- Light: canvas `#fff8f5`, sheet `#ffffff`, hairline `#f2d4da`, hover `#fdf1f1`, text `#4a2e33`. Dark: canvas `#14152b`, sheet `#1f2147`, hairline `#3a3768`, hover `#272a56`.
- Radii: sheet 16px, control 8px (kit currently 9px), pills full. No shadow at rest except the primary button and popovers.
- WCAG AA everywhere. Accent-coloured text uses `text-accent-ink`, never `text-accent`.
- New token is named `faint`, not `subtle`: `subtle` is already the border colour (`--color-subtle`).
- Keep `mp-hit`, reduced-motion CSS, 16px inputs on touch, and the `mp-fade-in-up` start at opacity 0.01 in `app/src/routes/layout.css`.
- `server/src/types.ts` and `app/src/lib/api/types.ts` stay byte-identical (no server changes in this plan).
- Branch flow: kit work on branch `feature/flat-redesign` in the kit repo; app work on `feature/ui-redesign-*` branches cut from `dev`, PR into `dev`, never `main`.
- Sidebar nav labels stay `Dashboard`, `Goal Tracker`, `Task Manager`, `Idea Vault`, `Vision Board` (e2e links to them by name).
- Tick items in `TODO.md` only if one matches; run `graphify update .` after the last task.

## Review Focus

1. Dark theme on every new primitive (hover tint vs sheet, pills, hairlines): each primitive has a dark-token contrast assertion.
2. Narrow widths (390px): `DataTable` must collapse to stacked rows without horizontal scroll (`reflow.e2e.ts`, `mobile.e2e.ts`).
3. Empty states: every list screen with zero rows shows an empty message, not a blank sheet.
4. Keyboard: row menu, segmented control and command palette are operable by keyboard with visible focus.
5. Long titles: a 200-char task or goal title truncates in the row and never pushes columns off the sheet.

## File Structure

Kit repo (`mushpoint-design`, cloned beside `Mushpoint/`):
- Modify `css/theme.css`: `faint` token, `--radius-sheet`, control radius 8px.
- Modify `utils/ui.ts`: flat `button`, `chip`, `segment`, `field`; add `sheet`, `row`, `pill`, `stat`; remove `lift` in the last task.
- Create `svelte/Sheet.svelte`, `SectionHeader.svelte`, `Stat.svelte`, `Pill.svelte`, `Segmented.svelte`, `DataTable.svelte`, `RowMenu.svelte`, `Breadcrumb.svelte`, `Toolbar.svelte`.
- Modify existing `svelte/*.svelte` (Checkbox, Select, DatePicker, Drawer, Tooltip, ProgressBar, ProgressRing, TagInput, ErrorBanner, ConfirmDialog).
- Create `test/*.spec.ts`, `vitest.config.ts`.

App:
- Create `src/lib/shell/crumbs.ts` (route to breadcrumb), `src/lib/search.ts` (palette matching), `src/lib/statusTone.ts` (status to pill tone).
- Create `src/lib/components/shell/Sidebar.svelte`, `TopBar.svelte`, `PageHeader.svelte`, `CommandPalette.svelte`.
- Modify `src/routes/+layout.svelte`, `src/routes/layout.css`, every `src/routes/*/+page.svelte`, and the dashboard, goals, tasks, ideas, vision, account components.
- Delete app-local duplicates of kit components once unused.

---

### Task 1: Kit workspace and tokens

**Files:**
- Create: `../Mushpoint-Design/vitest.config.ts`, `../Mushpoint-Design/test/tokens.spec.ts`
- Modify: `../Mushpoint-Design/css/theme.css`, `../Mushpoint-Design/package.json`

**Interfaces:**
- Produces: CSS tokens `--mp-faint` (per theme), `--color-faint` (utility `text-faint`), `--radius-sheet: 16px`, `--radius-control: 8px`.

- [ ] **Step 1:** `git clone https://github.com/Vu1nea/Mushpoint-Design.git ../Mushpoint-Design`, create branch `feature/flat-redesign`, `npm i -D vitest`, add `"test": "vitest --run"`, and a `vitest.config.ts` that uses `@sveltejs/vite-plugin-svelte` with `environment: 'node'` and `include: ['test/**/*.spec.ts']`.
- [ ] **Step 2:** Write `test/tokens.spec.ts`. It reads `css/theme.css`, extracts `--mp-faint`, `--mp-surface`, `--mp-surface-raised` per theme block, and asserts `contrast(faint, surface) >= 4.5` and `contrast(faint, surfaceRaised) >= 4.5` for both `nocturne` and `coquette` (WCAG relative-luminance helper inside the test). Also asserts `--radius-sheet: 16px` and `--radius-control: 8px` are present.
- [ ] **Step 3:** Run `npm test`. Expected: FAIL (token missing).
- [ ] **Step 4:** In `theme.css` add `--mp-faint` per theme (start with light `#7a6a6d`, dark `#8f92c0`; adjust until the test passes), map `--color-faint: var(--mp-faint)`, add `--radius-sheet`, change `--radius-control` to 8px.
- [ ] **Step 5:** Run `npm test`. Expected: PASS.
- [ ] **Step 6:** Commit `feat: faint text token and sheet radius`.

### Task 2: Kit class builders

**Files:**
- Modify: `../Mushpoint-Design/utils/ui.ts`
- Test: `../Mushpoint-Design/test/ui.spec.ts`

**Interfaces:**
- Produces (all in `utils/ui.ts`):
  - `export const sheet: string`: `rounded-[var(--radius-sheet)] bg-surface border border-subtle`, no shadow.
  - `export const row: string`: dense row, `border-b border-subtle last:border-b-0 hover:bg-surface-raised`, `min-h-11`.
  - `export type PillTone = 'neutral' | 'active' | 'done' | 'warn' | 'danger'`
  - `export function pill(tone: PillTone): string`: dot + label capsule; each tone uses the existing secondary/tertiary/warn/danger token at 15% fill with `text-content`.
  - `export const stat: { value: string; label: string; delta: string }`: `tabular-nums` value, `text-faint` label.
  - `button`, `chip`, `segment`, `field` keep their names and keys but lose borders-on-everything: `ghost` and `icon` become borderless with `hover:bg-surface-raised`; `chip(active)` and `segment(active)` become a tinted pill (`bg-surface-raised` active) instead of a filled accent block.

- [ ] **Step 1:** Write `test/ui.spec.ts`: `pill('done')` contains `rounded-full`; each `PillTone` returns a distinct string; `sheet` contains no `shadow`; `button.ghost` contains no `border `; `chip(true)` differs from `chip(false)` and contains no `bg-accent `; `lift` is still exported (removed in Task 15).
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement the builders above in `utils/ui.ts`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: flat class builders`.

### Task 3: Kit structural components

**Files:**
- Create: `../Mushpoint-Design/svelte/{Sheet,SectionHeader,Stat,Pill,Segmented,Toolbar,Breadcrumb}.svelte`
- Test: `../Mushpoint-Design/test/structure.spec.ts`

**Interfaces:**
- `Sheet`: props `{ class?: string; children: Snippet }`; renders `<section class={sheet}>`.
- `SectionHeader`: `{ title: string; count?: number; actions?: Snippet }`; title is an `<h2>`.
- `Stat`: `{ label: string; value: string | number; delta?: string; tone?: 'up' | 'down' | 'flat' }`; renders a `<dl>` pair, delta text carries an `sr-only` direction word.
- `Pill`: `{ tone: PillTone; children: Snippet }`.
- `Segmented<T extends string>`: `{ options: { value: T; label: string; count?: number }[]; value: T (bindable); ariaLabel: string }`; role `radiogroup` with arrow-key navigation, same pattern as the app's `Tabs`.
- `Toolbar`: `{ children: Snippet }` flex row, wraps on narrow widths.
- `Breadcrumb`: `{ items: { label: string; href?: string }[] }`; `<nav aria-label="Breadcrumb">`, last item `aria-current="page"`.

- [ ] **Step 1:** Write tests using `render` from `svelte/server`: Stat renders value, label and the sr-only delta word; Segmented marks the selected option `aria-checked="true"` and shows counts; Breadcrumb's last item has `aria-current="page"` and is not a link; SectionHeader renders an `h2`; Pill renders its children inside a `rounded-full` element.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement the seven components with the props above.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: sheet, stat, pill, segmented, breadcrumb primitives`.

### Task 4: Kit DataTable and RowMenu

**Files:**
- Create: `../Mushpoint-Design/svelte/DataTable.svelte`, `RowMenu.svelte`
- Test: `../Mushpoint-Design/test/datatable.spec.ts`

**Interfaces:**
- `DataTable<R>`: `{ columns: { key: string; label: string; width?: string; align?: 'start' | 'end'; hideBelow?: 'md' }[]; rows: R[]; rowKey: (r: R) => string | number; cell: Snippet<[R, string]>; empty: string; ariaLabel: string; onRowClick?: (r: R) => void }`. Renders an ARIA grid (`role="table"`, `row`, `columnheader`, `cell`) using CSS grid; below `md` columns marked `hideBelow` disappear and the first column shows a two-line title/sub-line. Truncates long cells with `truncate`. Empty rows array renders the `empty` text in a single row.
- `RowMenu`: `{ items: { label: string; onSelect: () => void; danger?: boolean }[]; label: string }`; a `⋯` button (`aria-haspopup="menu"`) opening a popover built on the kit's `popover.svelte.ts`; Escape closes, arrow keys move, focus returns to the button.

- [ ] **Step 1:** Tests: header cells have `role="columnheader"`; N rows render N `role="row"` plus one header row; empty array renders the empty text and no body rows; a column with `hideBelow: 'md'` carries `max-md:hidden`; RowMenu button has `aria-haspopup="menu"` and the passed `aria-label`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement both components.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: DataTable and RowMenu`.

### Task 5: Restyle existing kit components, release, bump pin

**Files:**
- Modify: kit `svelte/{Checkbox,Select,DatePicker,Drawer,Tooltip,ProgressBar,ProgressRing,TagInput,ErrorBanner,ConfirmDialog}.svelte`
- Modify: `app/package.json`, `app/package-lock.json`

- [ ] **Step 1:** Replace `rounded-card`, `shadow-*` and `bg-surface-raised` panel fills with the flat vocabulary: popovers and dialogs keep a border and soft shadow, inline controls lose shadows, `ProgressBar` becomes a 4px bar, `ProgressRing` keeps its conic ring but loses its card.
- [ ] **Step 2:** In the kit, run `npm test` and `npx svelte-check`. Expected: PASS.
- [ ] **Step 3:** Commit, push `feature/flat-redesign`, open the kit PR and merge it. Note the merge commit hash.
- [ ] **Step 4:** In the app (new branch `feature/ui-redesign-shell` from `dev`), set the `mushpoint-design` dependency in `app/package.json` to that hash and run `npm install`.
- [ ] **Step 5:** Run `npm run check && npm test && npm run lint` in `app/`. Expected: PASS (the existing `Select.spec.ts` and `ConfirmDialog.spec.ts` must still pass; fix any class-name assertions they make).
- [ ] **Step 6:** Commit `chore(app): bump mushpoint-design to flat redesign`.

### Task 6: Shell helpers (breadcrumbs, search, status tones)

**Files:**
- Create: `app/src/lib/shell/crumbs.ts`, `app/src/lib/search.ts`, `app/src/lib/statusTone.ts` and a `.spec.ts` beside each.

**Interfaces:**
- `crumbsFor(pathname: string): { label: string; href?: string }[]`. Root is `Dashboard`; `/goals` is `Goals`; `/goals/12` is `Goals` (link) then `Goal`; `/tasks`, `/ideas`, `/vision-board`, `/settings` likewise; unknown path returns `[{ label: 'Mushpoint' }]`.
- `type SearchHit = { kind: 'goal' | 'task' | 'idea'; id: number; title: string; href: string }`
- `searchItems(query: string, data: { goals: Goal[]; tasks: Task[]; ideas: Idea[] }, limit = 8): SearchHit[]`. Case-insensitive substring on title; prefix matches rank before inner matches; empty or whitespace query returns `[]`. Hrefs: goal `/goals/{id}`, task `/tasks`, idea `/ideas`.
- `statusTone(status: GoalStatus | TaskStatus): PillTone` via an exhaustive `Record` so a new status fails type-check.

- [ ] **Step 1:** Write specs. crumbs: the cases above. search: prefix beats inner match, limit respected, whitespace query returns `[]`, 200-char title does not throw. statusTone: every member of `GoalStatus` and `TaskStatus` returns a valid tone (iterate the unions' known values from `types.ts`).
- [ ] **Step 2:** Run `npm test -- crumbs search statusTone`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same. Expected: PASS.
- [ ] **Step 5:** Commit `feat(app): shell helpers`.

### Task 7: Shell: canvas, sidebar, top bar, command palette

**Files:**
- Create: `app/src/lib/components/shell/{Sidebar,TopBar,PageHeader,CommandPalette}.svelte`
- Modify: `app/src/routes/+layout.svelte`, `app/src/lib/components/shell/{MobileTopBar,MobileTabBar,MobileMenuSheet}.svelte`
- Test: update `app/e2e/shell.e2e.ts`, `a11y.e2e.ts`, `reflow.e2e.ts`, `mobile.e2e.ts`

**Interfaces:**
- `Sidebar`: `{ open: boolean; items: NavItem[]; isCurrent: (href: string) => boolean; onToggle: () => void; ... }`. Groups: `Workspace` (Dashboard, Goal Tracker, Task Manager, Idea Vault, Vision Board) and `Account` (Settings via `SidebarUser`). Same 236/76px widths and `mushpoint:sidebar-open` key.
- `TopBar`: `{ crumbs: Crumb[]; onSearch: () => void }`; breadcrumb left, search field (shows `Ctrl K`) and avatar right.
- `PageHeader`: `{ title: string; subtitle?: string; actions?: Snippet }`; renders the page `<h1>`.
- `CommandPalette`: `{ open: boolean; onClose: () => void }`; loads goals, tasks and ideas once on first open through the existing `$lib/api` list functions, filters with `searchItems`, `Ctrl/Cmd+K` toggles, arrows and Enter navigate with `goto`, Escape closes and restores focus.

- [ ] **Step 1:** Extend `shell.e2e.ts`: `Ctrl+K` opens a dialog named `Search`, typing a seeded goal title shows it, Enter navigates to that goal; the sidebar still links by the labels in Global Constraints; the collapse button keeps its accessible name (update the one the spec renamed earlier if it differs).
- [ ] **Step 2:** Run `npm run test:e2e -- shell`. Expected: FAIL.
- [ ] **Step 3:** Build the four components; rewrite `+layout.svelte` so the canvas is `bg-background`, the main area is a single `Sheet` with `TopBar` above it, and the mobile bars use the new tokens.
- [ ] **Step 4:** Run `npm run check && npm test && npm run test:e2e`. Expected: PASS, including axe in both themes and the 390px reflow checks.
- [ ] **Step 5:** Open PR into `dev`, commit `feat(app): flat shell, top bar, command palette`.

### Task 8: Dashboard

**Files:**
- Modify: `app/src/routes/+page.svelte`, `app/src/lib/components/dashboard/*.svelte`, `app/src/lib/dashboard.ts`
- Test: `app/src/lib/dashboard.spec.ts`, `app/e2e/web.e2e.ts`

**Interfaces:**
- Produces in `dashboard.ts`: `dashboardStats(goals: Goal[], tasks: TaskSummary[], streaks: StreakCard[], now?: Date): { activeGoals: number; dueToday: number; bestStreak: number }`. The spec lists a fourth stat (ideas); the dashboard load does not fetch ideas, so it is left out here and called out in the PR.

- [ ] **Step 1:** Add to `dashboard.spec.ts`: zero data returns all zeros; completed or archived goals are excluded from `activeGoals`; `dueToday` equals `todaysTasks(...).length`; `bestStreak` is the max current streak, 0 when none.
- [ ] **Step 2:** Run `npm test -- dashboard`. Expected: FAIL.
- [ ] **Step 3:** Implement `dashboardStats`; rebuild the page: `PageHeader` (title `Dashboard`, today's date line, primary action `New goal`), a `Stat` strip, "Tasks today" as `Segmented` + `DataTable`, streaks and vision preview side by side separated by a hairline, upcoming as plain rows. Quick add becomes a header action that opens the existing drawers. Remove the card wrappers from every `Dashboard*.svelte`.
- [ ] **Step 4:** Run `npm run check && npm test && npm run test:e2e`. Expected: PASS; empty-state check: a new user sees empty messages in each section.
- [ ] **Step 5:** PR into `dev`, commit `feat(app): flat dashboard`.

### Task 9: Tasks screen

**Files:**
- Modify: `app/src/routes/tasks/+page.svelte`, `components/tasks/{TaskRow,KanbanBoard,CalendarView,GanttChart,TaskDrawer}.svelte`
- Test: `app/e2e/web.e2e.ts`, `a11y.e2e.ts`

- [ ] **Step 1:** Add e2e: list view shows a table with columns Task, Goal, Due, Status; `Segmented` filters show counts and filtering by `Open` hides done tasks; the row menu offers Edit and Delete; a 200-char title does not overflow the sheet at 1440 and 390px.
- [ ] **Step 2:** Run `npm run test:e2e -- web`. Expected: FAIL.
- [ ] **Step 3:** List view becomes `DataTable` with `statusTone` pills and `RowMenu`; `Toolbar` holds search and the existing filters. Kanban, Calendar and Gantt keep their logic and specs (`kanban.spec.ts`, `calendar.spec.ts`, `gantt.spec.ts` must still pass); remove nested card chrome so only draggable task cards have borders.
- [ ] **Step 4:** Run `npm run check && npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5:** PR into `dev`, commit `feat(app): flat tasks screen`.

### Task 10: Goals and goal detail

**Files:**
- Modify: `app/src/routes/goals/+page.svelte`, `goals/[id]/+page.svelte`, `components/goals/{SubgoalCard,GoalDrawer,SubgoalDrawer,GoalStatusSegment,GoalCompleteCelebration}.svelte`
- Test: `app/e2e/web.e2e.ts`

- [ ] **Step 1:** E2E: goals list is a table (Goal, Category, Progress, Due, Status); goal detail shows a stat strip and subgoals as rows; creating a subgoal adds a row; empty goal list shows an empty message.
- [ ] **Step 2:** Run `npm run test:e2e -- web`. Expected: FAIL.
- [ ] **Step 3:** Rebuild both pages with `DataTable`, `Stat`, `Pill` and `ProgressBar`; replace `SubgoalCard` with a row component (rename the file `SubgoalRow.svelte`, update imports).
- [ ] **Step 4:** Run `npm run check && npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5:** PR into `dev`, commit `feat(app): flat goals screens`.

### Task 11: Ideas

**Files:**
- Modify: `app/src/routes/ideas/+page.svelte`, `components/ideas/IdeaDrawer.svelte`

- [ ] **Step 1:** E2E: ideas render as rows with tags as pills; tag filter and promote action still work; empty state present.
- [ ] **Step 2:** Run `npm run test:e2e -- web`. Expected: FAIL.
- [ ] **Step 3:** Rebuild with `DataTable` (Idea, Tags, Created) and `RowMenu`.
- [ ] **Step 4:** Run `npm run check && npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5:** PR into `dev`, commit `feat(app): flat ideas screen`.

### Task 12: Vision board

**Files:**
- Modify: `app/src/routes/vision-board/+page.svelte`, `components/vision/{VisionBoard,VisionItemDrawer}.svelte`

- [ ] **Step 1:** E2E: vision items show without a surrounding card, caption on hover and focus; empty state present; `a11y.e2e.ts` passes with images.
- [ ] **Step 2:** Run `npm run test:e2e`. Expected: FAIL on the new assertions.
- [ ] **Step 3:** Remove card frames and shadows; keep `paper.ts` rotation logic only if it still reads on the flat sheet, otherwise drop the tilt and delete the code it makes dead.
- [ ] **Step 4:** Run `npm run check && npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5:** PR into `dev`, commit `feat(app): flat vision board`.

### Task 13: Settings, account and auth pages

**Files:**
- Modify: `app/src/routes/settings/+page.svelte`, `components/account/AccountSettings.svelte`, `routes/{login,signup,forgot-password,welcome,auth/callback}/+page.svelte`, `routes/+error.svelte`

- [ ] **Step 1:** E2E: settings sections are separated by hairlines with `SectionHeader`; login, signup and forgot-password still pass axe in both themes.
- [ ] **Step 2:** Run `npm run test:e2e`. Expected: FAIL on the new structure assertions.
- [ ] **Step 3:** Flat sections for settings; auth pages use one centred `Sheet`.
- [ ] **Step 4:** Run `npm run check && npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5:** PR into `dev`, commit `feat(app): flat settings and auth`.

### Task 14: Cleanup

**Files:**
- Modify: kit `utils/ui.ts` (remove `lift`), app `components/ui/*` duplicates, `app/package.json` pin

- [ ] **Step 1:** `grep -rn "lift\b\|rounded-card\|surface-raised" app/src` and list every remaining use; each must be a deliberate hover or selected tint, not a card.
- [ ] **Step 2:** Remove `lift` from the kit, delete app-local wrappers that no longer add anything (for example `ui/Select.svelte` if it only re-exports), merge kit PR, bump the pin.
- [ ] **Step 3:** Run `npm run check && npm run lint && npm test && npm run test:e2e` in `app/`. Expected: PASS.
- [ ] **Step 4:** Run `graphify update .`, tick any matching `TODO.md` items, and add a short note on the flat-surface decision to `docs/decisions.md`.
- [ ] **Step 5:** Commit `chore: remove card-era leftovers`.
