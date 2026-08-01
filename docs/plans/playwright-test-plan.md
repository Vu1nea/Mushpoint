# Playwright QA Test Plan — Goal Tracker mockup

Source: `Mushtrack Static Design/Goal Tracker.dc.html` (dc-runtime React prototype, sample fixture data, no persistence, hash-routed SPA).

## Setup notes (read before writing tests)

- **No `data-testid`/`id`/`class` hooks anywhere in the markup.** Every locator has to go through role, text, or placeholder. A few spots are genuinely ambiguous (see Findings below) — worth raising with design/dev before writing brittle XPath workarounds.
- **Needs network access.** `support.js` loads React/ReactDOM/Babel from `unpkg.com` at boot. Tests won't run in an offline/sandboxed CI runner without vendoring those or mocking the CDN requests.
- **Needs an HTTP server, not `file://`.** The runtime does `fetch(location.href)` on boot to re-parse its own template; Chromium blocks that under `file://`. Serve the `Mushtrack Static Design` folder (e.g. `npx serve`, a tiny Node static server, or Playwright's `webServer` config) and navigate to `http://localhost:PORT/Goal%20Tracker.dc.html`.
- **State is 100% client-side and resets on reload.** Fixture data (5 goals, 20 tasks, 3 projects, 6 ideas, 8 vision items, 7 targets) is defined in the inline `<script data-dc-script>` `Component.state`. A full `page.goto()` remounts fresh; this is actually convenient for test isolation — every test can start clean by (re)loading — but a multi-step test (e.g. delete → undo) must navigate *in-app* (click a link, or set `location.hash`) rather than call `page.goto()` again mid-test, or it'll lose its own mutations.
- **Deep-linking works.** `applyHash()` reads `window.location.hash` on mount, so `page.goto('...#/goals/g1')` lands directly on that page — no need to click through the sidebar for every test.
- **The drawer's save has a simulated 30% random failure** (`Math.random() < 0.3` in `submitDrawer`). Any test asserting the happy-path "Create" flow will flake ~30% of the time unless `Math.random` is stubbed via `page.addInitScript()` before navigating. Use one stub value to force success, another to force failure (for testing the error/Retry UI deterministically).

## Fixture data reference (for writing assertions)

- Goals (`g1`–`g5`, all `status: active` by default): Ship portfolio redesign (Side Projects), Deadlift 315 lb (Gym), Finish Data Structures course (School), Get promoted to Senior (Work), Host a monthly game night (Social).
- `g1` has subgoals `sg1` (Design new case studies — expanded by default via `expandedSubgoals: {sg1:true}`) and `sg2` (Launch on custom domain, collapsed).
- Projects: Portfolio Redesign (`p1`, linked to `g1`), Q3 Roadmap Planning (`p2`, no goal), Game Night Rotation (`p3`, linked to `g5`).
- Recurring/streak tasks: "Morning mobility routine" (daily, streak 12/30), "Read 20 min" (daily, 5/18), "Log workout" (weekly, 8/21).
- Ideas: 6 fixture ideas, each with 0–2 tags already attached.
- Vision items: 8 fixture items (mix of image/quote) **plus 2 auto-generated per active goal** (a quote from its motivation + an image reusing the goal's own image slot) → 18 total cards on first load.
- Default theme: Nocturne (dark). Toggle theme: Coquette (light).
- Default filters: Goals list → status `active`; Project detail → view `board`, target filter `all`.

## Known mockup quirks to test *for* (not just around)

1. **Dashboard checkbox is a 3-state cycler, not a boolean toggle.** In the inline script, the `tasksAugmented` object literal defines the `toggle` key twice — once as `toggleTaskDone` (boolean flip), then again as `cycleTaskStatus` (todo→in_progress→done→todo). The second wins. This function backs *both* the Dashboard "Today's Tasks" checkboxes *and* the Task Manager board cards. Net effect: clicking a Dashboard checkbox on a `todo` task does **not** check it — it silently moves it to `in_progress` first, and the checkbox stays visually unchecked. A second click is needed to reach `done`. Worth a dedicated test asserting this literal behavior (and worth flagging to the dev as probably-unintended, since a checkbox strongly implies single-click boolean toggle).
2. **Same bug does not affect the Goal Detail subgoal task list** — that list builds its own `tasksForSg` array with `toggle: () => this.toggleTaskDone(tk.id)` defined once, so it *is* a normal boolean toggle there. A test that checks a subgoal task should see it flip on the first click, in contrast to #1.
3. **Casing inconsistency between board and list views on Project Detail.** Kanban column headers read "To Do" / "In Progress" / "Done" (`boardColumns` labels). Switching to List view renders the same statuses per-row as "To do" / "In progress" / "Done" (`filteredProjectTasks[].statusLabel` — only first word capitalized). A test can use this exact-text difference to assert the board view is actually gone after switching, and it's a legitimate copy-consistency bug to log separately.
4. **"New Idea" drawer type is dead code.** `_commitDrawer` and the `drawerNeedsNote`/`drawerNeedsCategory` etc. flags all handle `drawerType === 'idea'`, and `drawerTypeLabels.idea === 'New Idea'` — but nothing in the template ever calls `openDrawer('idea')`. Ideas can only be created via the inline Capture bar on the Idea Vault page or via Dashboard Quick Add (type `idea`). No test can open this drawer through the UI; flag it to dev rather than writing a test for it.
5. **Grace period label never pluralizes.** Settings → Streaks shows `{{ streakGrace }} days` unconditionally, so it reads "1 days" at grace=1. Assert the literal current text; it's a minor copy nit worth a one-line note, not a blocker.
6. **Checkbox hit targets are visually zero-opacity `<input>`s layered under a decorative `<span>`.** Playwright's actionability check doesn't care about `opacity:0` (only `display`/`visibility`/size), so `.check()` on the raw input *should* work, but the decorative span sits in normal flow on top of an absolutely-positioned input at the same coordinates and can intercept the click. Prefer clicking the wrapping `<label>` (native label-forwarding) over interacting with the checkbox input directly, for every checkbox in this document.
7. **Kanban cards have no per-column/per-status attribute.** Task Manager board cards and Project board cards carry no `data-status` or similar — after clicking a card to cycle its status, there's no reliable structural way to assert *which* column it landed in beyond fragile text/position matching. Verifying "the title is still present somewhere on the board" is about as far as a black-box test can go without a testability hook being added; flag this as a testability gap for the dev to add a `data-status` attribute.

## Suggested project layout

```
playwright-tests/
  package.json                 — @playwright/test devDependency, npm scripts
  playwright.config.ts         — webServer (static file server) + baseURL
  static-server.js             — zero-dependency Node http server for "Mushtrack Static Design"
  tests/
    helpers.ts                 — goTo(page, hash), forceDrawerSaveSuccess/Failure(page)
    navigation.spec.ts
    dashboard.spec.ts
    goals.spec.ts
    goal-detail.spec.ts
    projects.spec.ts
    tasks.spec.ts
    ideas.spec.ts
    vision.spec.ts
    settings.spec.ts
    drawer.spec.ts
```

---

## Test suites

### 1. `navigation.spec.ts` — App shell & routing

- Loading the app with no hash defaults to `#/dashboard` and renders the "Today" heading.
- Each of the 7 sidebar links (Dashboard, Goal Tracker, Project Manager, Task Manager, Idea Vault, Vision Board, Settings) navigates to its route and shows the expected `h1`, for both a click-through and a direct deep-link (`page.goto` straight to the hash).
- Collapsing the sidebar (top-bar "Toggle sidebar" button) hides text labels (e.g. "Mushpoint" wordmark) but nav links remain clickable by icon.
- The quick theme-toggle switch at the bottom of the sidebar flips the active theme name (Nocturne ↔ Coquette) — verified via the sidebar's theme-name label specifically (the Settings page also renders "Nocturne"/"Coquette" as static swatch labels, so the locator must be scoped to avoid that collision).

### 2. `dashboard.spec.ts`

- Core widgets render: "Today" heading + date, "Active Goals", "Vision Board" preview, "Today's Tasks", "Streaks", "Upcoming", "Quick Add".
- Clicking a goal title inside "Active Goals" navigates to that goal's detail page.
- The Vision panel's "Open →" link navigates to `#/vision`.
- **Checkbox-cycling quirk (Findings #1):** clicking a `todo` task's checkbox once does *not* check it (moves to `in_progress`); a second click checks it. Use "Build responsive layout" (`t3`, `todo`, present in the first 6 dashboard tasks) as the fixture.
- Quick Add:
  - Default type is "Task" (input placeholder "Capture a new task…").
  - Switching type buttons (Idea/Task/Goal) changes the input placeholder accordingly.
  - Submitting a title creates a real task/idea/goal and it becomes visible in the relevant list (verify at least the task case, since it's visible on the same page).
  - Submitting empty shows "Type something before adding" and does not add anything (also a good place to note the shake animation is purely cosmetic and not independently assertable).

### 3. `goals.spec.ts` — Goals list

- Default view: "5 active across 5 categories", all 5 fixture goal titles visible, grouped by category.
- Status chips (Active/Completed/Archived) filter the list; Completed/Archived start empty and show "No {status} goals here yet."
- Category `<select>` narrows to one category's goals and hides the rest.
- Clicking a goal card navigates to its detail page (verify heading + category badge).
- "New Goal" opens the drawer titled "New Goal" with Category select, Timeframe buttons (Short/Mid/Long), Motivation textarea, and a due-date field present (and confirm Parent-goal/Note/Recurring fields are *absent* for this drawer type).

### 4. `goal-detail.spec.ts`

- Header renders title, category badge, timeframe/due, progress %, motivation quote, and the 3 status buttons (Active/Completed/Archived).
- `sg1` ("Design new case studies") starts expanded per fixture state; its tasks (e.g. "Pick 3 projects to feature") are visible without any click.
- Clicking the subgoal row toggles expand/collapse (chevron rotation isn't independently testable, but task visibility is).
- Checking a subgoal task toggles instantly (Findings #2 — contrast with the dashboard's 2-click quirk). Use "Write case study copy" (`t2`, starts `in_progress` → unchecked).
- Typing into "Add a task…" and pressing Enter adds a task to that subgoal.
- Typing into "+ Add subgoal…" and pressing Enter adds a new subgoal.
- Edit (pencil icon, `title="Edit goal"`) opens the drawer pre-filled and titled "Edit Goal"; saving updates the heading in place.
- Delete (`title="Delete goal"`) opens a confirm dialog (`Delete "{title}"?`), Cancel closes it with no change, Delete removes the goal, redirects to the Goals list, shows an undo toast (`"{title}" deleted`), and Undo restores it — verify the full round trip in one test since it's all in-memory state.
- Changing status via the sidebar buttons (e.g. mark "Deadlift 315 lb" Completed) removes it from the default Active-filtered Goals list and shows it under the Completed filter — navigate back via the "← Back to Goals" link, not `page.goto`, to preserve the mutation.

### 5. `projects.spec.ts`

- Projects list: heading, "3 in progress", all 3 project cards with name + parent-goal label + To do/In progress/Done counts.
- Clicking a project card opens its detail page (board view by default) showing To Do / In Progress / Done columns.
- "New Project" drawer only has Title + optional Parent-goal select (no category/timeframe/motivation/recurring fields).
- Project detail: clicking a target chip (e.g. "Content") filters the board to that target's cards only; "All" clears the filter back.
- View toggle: switching Board → List renders a flat row list instead of columns — use the casing difference from Findings #3 ("To Do" board header vs "To do" row label) to assert the switch actually happened, not just that some text is present.
- Adding a task via the "+ Add task" input (Enter key) in a board column — note there are 3 identical "+ Add task" placeholders (one per column, no distinguishing attribute), so scope with `.first()`/positional index and treat this as a known selector fragility (Findings #7).

### 6. `tasks.spec.ts` — Task Manager

- Heading, streak cards for the 3 recurring tasks with their current/longest counts, and a 3-column board (To Do/In Progress/Done) populated from the non-recurring/standalone task fixtures.
- Clicking a board card cycles it through the 3-state status loop; verify the card's title is still present after 1, 2, and 3 clicks (full loop back to start) — see Findings #7 for why per-column assertion isn't reliably possible here.
- "New Task" opens a drawer with Title, optional Parent-goal select, due date, and a "Recurring task" checkbox — and confirm Category/Motivation/Note fields are absent.

### 7. `ideas.spec.ts` — Idea Vault

- Heading + "6 captured", all 6 fixture idea titles visible, existing tags render as removable pill buttons (e.g. "Gym ×").
- Capturing a new idea (title + optional note, "Capture" button) adds it to the top of the list.
- Adding a tag via the "+ tag…" input (Enter) shows a new pill; clicking a pill's "×" removes it. Scope all of this to the specific idea card via `div[style*="break-inside:avoid"]` filtered by the idea's title text — plain text-based ancestor matching is ambiguous here since the outer masonry container and the card itself both "contain" the title text.
- "Make Goal" removes the idea from the vault and creates+navigates to a new goal with the idea's title (and its note as the motivation).
- "Make Project" removes the idea from the vault and creates+navigates to a new project with the idea's title.
- Note: there is no drawer-based idea creation flow to test (Findings #4) — only the inline Capture bar and Dashboard Quick Add reach idea creation in the UI.

### 8. `vision.spec.ts`

- Heading + "18 items" (8 fixture items + 2 auto-generated per active goal × 5 goals) — this count is a fixture-coupled assertion, worth a comment explaining the math so it doesn't look like a magic number.
- A fixture image caption and a goal-motivation-derived quote card are both visible, confirming the goal-vision auto-pull actually renders.
- Sort chips ("Most recent" / "By category") switch ordering without changing the total item count.
- "+ Add" opens the vision drawer, defaults to Image type (shows "Drop an image" image-slot placeholder); switching to Quote hides the image slot; switching to "From idea" reveals a select populated from the ideas list.

### 9. `settings.spec.ts`

- Both theme swatches (Nocturne, Coquette) render with their name and 3 accent dots; all 5 default categories are listed; About block shows the version string.
- Clicking a swatch switches the active theme — assert via the sidebar's theme-name label, not the swatch's own (static) label text, since both literally say "Coquette"/"Nocturne" regardless of which is active.
- Adding a category via "+ Add category…" (Enter) appends it to the category list.
- Grace-period stepper: default "2 days"; `+` increments, `−` (note: U+2212 minus sign, not a hyphen, in the source) decrements; clamps at 0 (never negative) — also note the un-pluralized "1 days" label from Findings #5 rather than treating it as a test bug.
- "Export now" changes the "last export …" label from "3 days ago" to "just now".

### 10. `drawer.spec.ts` — Cross-cutting create/edit drawer behavior

(Complements the per-type field checks already listed in each page's suite above; this file focuses on the drawer's shared submit/validation/error machinery.)

- Submitting with an empty Title shows "Title is required" inline and the drawer stays open (no navigation, nothing added).
- With `Math.random` stubbed to force the 30% failure branch: submitting shows the "Couldn't save" error banner with a Retry button; Retry re-attempts and (still stubbed to fail) shows the error again — confirms Retry actually re-invokes the save rather than just closing.
- With `Math.random` stubbed to force success: filling out a full "New Goal" form and submitting closes the drawer and the new goal appears on the Goals list.
- Editing an existing goal (via the pencil icon) pre-fills the Title field with its current value; changing it and saving updates the goal's heading in place — confirms edit vs. create both flow through the same drawer/commit path correctly.
