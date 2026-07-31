# QA Playwright Test Plan — Goal Tracker.dc.html

## Context

File is static design prototype (`Mushtrack Static Design/Goal Tracker.dc.html`) — single-page hash-router app built on custom "DC" component framework (`support.js`), all state client-side/in-memory (no backend, no persistence, no real async yet). Covers 7 pages: Dashboard, Goals (list+detail), Projects (list+detail, 3 view modes), Tasks, Idea Vault, Vision Board, Settings — plus one universal "create" drawer reused for Goal/Project/Task/Idea/Vision creation.

Task: from QA perspective, list Playwright tests needed — including forward-looking coverage for error screens/messages that don't exist yet but are planned for every failure point (forms, loading).

**Testability caveat:** no `data-testid`/`aria-*` hooks anywhere in current markup — selectors would rely on text content, `href`, or DOM structure, which is brittle. Recommend adding `data-testid` to interactive elements (nav links, buttons, inputs, drawer, cards) before writing real Playwright specs.

## Test Plan by Area

### 1. Navigation & shell
- Sidebar nav links route correctly (`#/dashboard`, `#/goals`, `#/projects`, `#/tasks`, `#/ideas`, `#/vision`, `#/settings`); active item gets bold weight + accent background.
- Direct URL/hash navigation (deep link) lands on correct page without clicking through UI.
- Browser back/forward (`hashchange`) updates active page and nav highlight.
- Sidebar collapse/expand toggle: width transitions 236px↔76px, labels hide/show, icons stay visible.
- Theme toggle switch: flips Nocturne↔Coquette, persists across page navigation (not across reload — no persistence layer yet, worth asserting current behavior explicitly so a regression to "seems to persist" is caught).
- Unknown/invalid hash (e.g. `#/bogus`) — current: renders blank content area (no `sc-if` matches). **Future error state**: should show a "page not found" message — test once implemented.

### 2. Dashboard
- Today's date label renders correctly relative to mocked "now".
- Active Goals card: groups by category, shows max 2 goals/category, progress bar animates to correct width, links to correct goal detail.
- Vision Board preview: shows only image-type items, max 4.
- Today's Tasks: checkbox toggle flips done/undone state, strikethrough + color change applied, list caps at 6 and excludes done items on reload of filter.
- Streaks: current/longest numbers match data, cell grid renders 28 cells.
- Upcoming: sorted by due date ascending, correct kind label (Goal/Subgoal/Task), max 6 items, excludes completed tasks.
- Quick Add:
  - Type toggle (Idea/Task/Goal) switches placeholder text and active pill styling.
  - Enter key submits; button click submits.
  - Submitting empty/whitespace-only title is a no-op (current behavior) — **future**: should surface inline validation error ("Title required").
  - Successful submit adds to correct list (idea/task/goal) and clears input.
  - **Future**: submit failure (simulated network/save error) shows error message, preserves draft text so user doesn't lose input.

### 3. Goals
- List page: total count + category count in subtitle match data.
- Category filter chips: "All" + one per category, clicking filters goal groups shown, active chip styled distinctly.
- Empty category filter result (category with 0 goals) — group hidden entirely; confirm no empty-state artifact leaks through.
- Goal card: progress ring percentage matches computed completion, subgoal count correct, due-date label/color rules (`Overdue` red+bold, `Due <5 days>` accent, else neutral, `No due date` fallback).
- Goal detail page:
  - Back link returns to `#/goals`.
  - Nonexistent goal id (`#/goals/does-not-exist`) — current: sidebar/back link render, main panel blank (`activeGoal` null). **Future**: "Goal not found" error screen.
  - Sticky info panel shows category, title, timeframe, due, progress bar/pct, motivation quote, vision image slot.
  - Subgoal rows: expand/collapse chevron rotates, toggling shows/hides nested task list.
  - Nested task checkbox toggles done state same as dashboard behavior.
  - "Add a task…" input inside expanded subgoal: Enter adds task scoped to that subgoal+goal, clears input; empty submit no-ops (**future**: validation message).
  - "+ Add subgoal…" input at goal level: Enter creates subgoal under active goal; empty submit no-ops (**future**: validation message).

### 4. Projects
- List page: card count matches subtitle, each card shows progress ring, parent goal link label (or "No parent goal"), status counts (todo/in-progress/done), next due date (earliest across tasks, or "No due date").
- Project detail:
  - Back link, nonexistent project id → same "not found" gap as goals (**future** error screen).
  - View toggle (Board/List/Timeline) switches active view and highlights selected pill; state persists across target-filter changes but not across page nav (confirm intended).
  - Target filter chips ("All" + per-target): filters task list/board correctly; progress bar per target matches computed completion.
  - Board view: 3 columns (To Do/In Progress/Done), correct card bucketing by status, per-column "+ Add task" input creates task in that column scoped to current target filter (or unscoped if "All").
  - List view: rows show status dot color, target label, status label, correct filtered set.
  - Timeline view: dot horizontal position reflects days-until-due heuristic; task with no due date pinned near left edge.
  - Adding project task with empty title no-ops (**future**: validation message per column).

### 5. Tasks page
- Header count "{filtered} shown of {total}" matches applied filters.
- Streak cards duplicate dashboard streak logic — verify only recurring tasks shown.
- Filter chips: status (all/todo/in-progress/done — toggle behavior, clicking active chip resets to "all"), recurring-only, standalone-only; combinations compose correctly (e.g. status=todo + standalone-only).
- Task row: checkbox toggle, parent label (goal/subgoal path, project reference, or "Standalone"), recurring icon shown only when `recurring:true`, due label vs "Daily" (recurring w/ no due) vs "—" (no due, not recurring), status pill color/label correctness.
- "New Task" button opens drawer with task-specific fields (see §7).

### 6. Idea Vault
- Count subtitle matches list length.
- Capture input: Enter or button submits idea, prepends to list, clears input; empty submit no-ops (**future**: validation message).
- Idea card: title/note/tags render, masonry column layout doesn't clip content.
- "Make Goal" / "Make Project" promote actions: removes idea from vault, creates new goal/project seeded from idea title+note, navigates to new item's detail page (`#/goals/{id}` or `#/projects/{id}`).
- Promote when idea list is otherwise empty — confirm vault empties cleanly, no leftover placeholder.

### 7. Vision Board
- Count subtitle matches items.
- Sort chips (Most recent / By category) toggle active state — **note**: sort chip currently has no visible effect on card order in the data pipeline; verify whether that's a known gap or a bug once wired up.
- Quote cards vs image cards render distinct layouts (colored quote block vs image + caption overlay).
- "+ Add" opens drawer with vision-specific fields (type toggle Image/Quote, conditional image slot).
- Image slot component (`image-slot.js`) — drag/drop or click-to-upload flow, accepted file types, oversized/invalid file (**future**: error message instead of silent failure).

### 8. Settings
- Theme swatches: clicking switches active theme app-wide, ring highlight matches active theme, matches sidebar toggle behavior (single source of truth — test both entry points don't desync).
- Category rows list all categories with correct color swatch.
- "+ Add category" input: Enter creates category, clears input; empty submit no-ops (**future**: validation, and duplicate-name handling — currently no dedup check).
- Streak grace stepper: decrement floors at 0, increment caps at 7, button disables or no-ops correctly at bounds (**future**: consider disabling +/- visibly at bounds rather than silent no-op).
- "Export now" button: updates "last export" label to "just now" (currently synchronous/instant). **Future**: real export will be async — needs loading spinner + success/error states (e.g. export fails, file write error).

### 9. Universal Create Drawer
Reused across Goal/Project/Task/Idea/Vision — test each `drawerType` variant separately since conditional fields differ:
- Opening: correct title per type ("New Goal"/"New Project"/etc.), slide-in animation, backdrop click closes, X button closes.
- Field visibility matrix — verify exactly the right fields show per type:
  - Goal: Category (required, select), Timeframe (short/mid/long buttons), Motivation (textarea), Due date.
  - Project: Parent goal (optional select), Due date only if applicable per current logic (`drawerNeedsDue` includes task/goal only — confirm Project drawer correctly omits due date, matches design intent).
  - Task: Parent goal (optional), Due date, Recurring checkbox.
  - Idea: Note (textarea).
  - Vision: Type toggle (Image/Quote), image slot shown only when type=Image.
- Submit with empty title: current behavior silently closes drawer without creating anything — this is a **silent data-loss bug from a QA lens**, not just a missing error state; flag explicitly. **Future**: block submit, show inline "Title required" error, keep drawer open.
- Submit with valid data per type: confirm correct object shape appended to correct state array, drawer closes, and (for goal/project via idea-promotion path elsewhere) navigation behaves as expected.
- Closing mid-edit (backdrop/X) discards draft — confirm intended vs needing a "discard changes?" confirmation (**future** UX/error-adjacent concern).
- Select/dropdown for Category and Parent Goal: verify options list matches current `categories`/`goals` state, including newly-added categories/goals created earlier in the same session.

### 10. Loading states (future, currently absent — app is fully synchronous/in-memory)
Once real data-fetching exists, add:
- Initial app load shows skeleton/spinner before first render (`mounted`/`dashboardMounted` flags already gate animation — extend to gate a loading state).
- Route transition to a page needing fresh data (e.g. project detail) shows loading indicator until data resolves.
- Slow/failed network on dashboard, goals, projects, tasks, ideas, vision, settings — each needs its own loading skeleton test + timeout/error fallback test.
- Drawer submit shows in-flight/spinner state on submit button, disables double-submit.

### 11. Error states (future, currently absent)
- Not-found detail pages (goal/project with invalid id) — assert error message + a way back (link/button to list).
- Form validation errors — every drawer field and every quick-add/inline input (subgoal add, task add, category add, idea capture) needs a paired test: submit invalid → error message shown → correct/valid submit → error clears.
- Network/save failure toast or inline error for: quick add, drawer submit, task checkbox toggle, export now, image upload.
- Error message dismissal / auto-clear behavior once shown.
- Retry affordance where applicable (e.g. failed data load → retry button re-fetches).

### 12. Cross-cutting
- Responsive check at common breakpoints (grid layouts use fixed column counts — e.g. dashboard's `1.4fr 1fr` and `1fr 1fr 1fr` grids, projects' `auto-fill,minmax(280px,1fr)`, vision's 4-column masonry) — verify no overlap/overflow at narrow widths, since no explicit mobile breakpoints exist in current CSS.
- Keyboard accessibility: all inputs/buttons reachable via Tab, Enter submits where wired (quick add, subgoal add, category add, idea capture, project column add), focus ring visible (`style-focus` border-color rule).
- Color-scheme correctness for native `<input type="date">` (`color-scheme` bound to theme) in both themes.
- State isolation between pages — switching pages mid-filter (e.g. leave Tasks with a filter active, return) — confirm filters persist or reset per intended design.

## Verification

No test runner/Playwright config exists yet in this repo. Before writing actual spec files:
1. Confirm whether Playwright will run against this `.dc.html` file directly (via its custom render pipeline / `support.js`) or against a future built app.
2. Add `data-testid` attributes to key interactive elements (listed per section above) to make selectors stable.
3. Stand up a minimal Playwright config (`playwright.config.ts`) pointing at a local dev server serving this file, then implement specs section-by-section per this plan, starting with Navigation (§1) and Universal Drawer (§9) since nearly every other area depends on drawer-created data.