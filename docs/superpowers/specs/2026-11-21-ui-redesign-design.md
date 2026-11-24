# UI redesign: flat surface, dense rows

Date: 2026-11-21. Branch: `feature/ui-redesign`. Status: draft for approval.

## Intent and why

The layout is fine; the look is "generic cards on top of cards". Every panel is a bordered, rounded box, and boxes nest inside boxes. The redesign changes the visual language **and rebuilds the components**, in the direction of two references (a Linear/Plane-style workspace dashboard and a MailPulse-style reports table):

- One large surface on a quiet canvas. Sections are separated by hairlines and whitespace, not nested cards.
- Lists are dense rows with columns, status pills and a hover menu, not stacks of cards.
- Stats are bare numbers with a small delta. Cards survive only where the card is the content (tiles, vision images).
- A top bar (breadcrumb, search, avatar) and a page header (title, subtitle, primary action).

## Goals / non-goals / anti-goals

Goals
- Every screen uses the same flat-surface + row vocabulary.
- Kit (`mushpoint-design`) owns the new tokens and primitives; the app only composes.
- Light and dark both ship. WCAG AA kept (accent text via `text-accent-ink`).

Non-goals
- No team features: assignees, invites, workspaces, sprints. Reference elements with no Mushpoint data are mapped to existing data or dropped, never faked.
- No new server endpoints in this project (see Deferred).
- No feature changes to goals, tasks, streaks, ideas or vision behaviour.

Anti-goals
- A reskin that leaves card-in-card structure underneath.
- Two visual languages living side by side after the last PR.
- Overrides in `app/` that fight kit styles.

## Constraints

- Branch flow: `feature/*` -> PR -> `dev`. Kit changes land in the `mushpoint-design` repo first; `app/package.json` pin is bumped by commit hash.
- Existing e2e (Playwright + axe) and the Lighthouse FCP workaround (`mp-fade-in-up` from opacity 0.01) must keep passing.
- Keep `mp-hit` tap-target rule, reduced-motion handling, 16px inputs on touch.
- Mobile shell (top bar, tab bar, menu sheet) stays; it gets the same tokens, not a new structure.

## Approaches considered

1. **Kit first, then screens. Chosen.** New tokens and primitives in the kit, then shell, then one PR per screen. More up-front work; consistent result, no override hacks.
2. App-only restyle. Faster, one repo, but kit and app drift and kit Drawer/Select keep the old look.
3. Shell + dashboard only, rest later. Fast to see, but the app looks half-redone for a long time.

## Design

### 1. Tokens (kit `css/theme.css`)

- Three surface levels instead of two plus borders: `canvas` (outer), `surface` (the big sheet), `hover/selected` (row tint). Remove `surface-raised` as a card fill.
- Borders: one hairline token, used for dividers between sections and rows; boxes get a border only when they are interactive tiles.
- Radius: sheet 16px, control 8px, pill full. Retire `radius-card` 14px for panels.
- Shadows: none at rest, except the primary button and popovers.
- Type: drop display-font headings inside the sheet; page title only uses display. Add a tabular-nums utility for stats and columns.
- Palette (decided): keep the existing coquette (light) and nocturne (dark) colours; this project changes structure, not hues. Light: canvas `#fff8f5`, sheet `#ffffff`, hairline `#f2d4da`, hover/selected `#fdf1f1`, text `#4a2e33`. Dark maps the same way (canvas `#14152b`, sheet `#1f2147`, hairline `#3a3768`, hover `#272a56`). Accent stays the only colour for primary action and selection. Status colours (done/active/overdue) come from the existing secondary/tertiary/warn/danger tokens, used in pills only.
- One new token, `text-faint` (not `subtle`, which is already the border colour): a quiet warm gray (light) / dim lavender-gray (dark) for row sub-lines and column headers, so dense tables do not read pink everywhere. `text-muted` keeps its current pink/lavender for links and labels. Both must pass AA on sheet and hover tints; verify values before landing.

### 2. Primitives (kit `svelte/` + `utils/ui.ts`)

New: `Sheet` (flat surface + header slot), `SectionHeader` (title, count, actions, hairline), `StatRow` / `Stat` (number, label, delta), `DataRow` / `DataTable` (columns, hover, row menu, keyboard), `Pill` (status dot + label), `Segmented` (All 9 / Open 5 tabs with counts), `Toolbar` (search + filter), `RowMenu`, `Breadcrumb`, `CommandSearch` shell (UI only).
Restyled: Checkbox, Select, DatePicker, Drawer, Tooltip, ProgressBar, ProgressRing, TagInput, ErrorBanner, ConfirmDialog, `button` / `field` / `chip` / `segment` builders.
App-level components in `app/src/lib/components/ui` that duplicate kit ones are removed in favour of the kit versions where they match.

### 3. Shell (`app/src/routes/+layout.svelte` and `components/shell`)

- Gray canvas; main content is one `Sheet` with the page header inside it.
- Top bar: breadcrumb left, search + avatar right. Search is a field that opens a client-side command palette over already-loaded goals, tasks, ideas (no server search).
- Sidebar: grouped sections with small caps labels (Workspace: Dashboard, Goals, Tasks, Ideas, Vision; Account: Settings), counts as quiet badges, collapse button kept (236/76px, persisted key unchanged).
- Theme switch and credit move to the sidebar footer, tidier.
- Mobile: same tokens; top bar gains page title, tab bar unchanged.

### 4. Screens (one PR each, in this order)

1. **Dashboard.** Header + date line. Bare stat strip (active goals, due today, best streak, ideas). "Tasks today" as a segmented, dense list. Streaks (flat heatmap) and vision (borderless image strip) share one row under hairlines. Upcoming becomes a plain list. Quick add moves into the page header action.
2. **Tasks.** `DataTable` list view (title + sub-line, goal, due, status pill, row menu), segmented by status with counts, search + filter toolbar. Kanban, Calendar, Gantt keep logic; columns lose card-in-card chrome and use flat cards only for draggable items.
3. **Goals + goal detail.** Table of goals with progress ring/bar column, category, due, status. Detail page: header, stat strip, subgoals as rows (not `SubgoalCard` boxes).
4. **Ideas.** Rows with tags as pills.
5. **Vision board.** Borderless masonry; images are the cards.
6. **Settings, Account, auth pages, welcome, error.** Flat sections divided by hairlines; auth card stays a single centred sheet.

### 5. Reference-to-Mushpoint mapping

- "Work items created/assigned/subscribed" -> goals, tasks due today, streaks.
- Workload (Backlog / Not started / Working / Completed) -> task status counts strip.
- Cycle capacity / team performance charts -> goal progress and streak heatmap; no new chart library unless a screen needs one.
- Recent activity feed, profile panel, "Generate recap", Upcoming meetings: not built. Upcoming (due dates) is kept as a list.

## Testing

- Kit: unit tests for new utils; a visual smoke page in the kit repo if one exists.
- App: update unit/e2e selectors that break (e.g. sidebar collapse label). axe runs on every redesigned screen. Lighthouse unchanged thresholds.
- Manual: both themes, 390px and 1440px, keyboard pass on table and menu.

## Deferred / open

- Activity feed needs a server event log. Separate project.
- Server-side search endpoint for the command palette. Separate project.
- Right-hand context panel: only if a screen earns it, not planned.

## Calls I made (flag any you disagree with)

- Dark theme stays, both themes redone.
- Existing coquette and nocturne palettes kept in full (user's call); only `text-subtle` is new.
- Search is client-side over loaded data.
- Order: kit -> shell -> dashboard -> tasks -> goals -> ideas -> vision -> settings/auth.
