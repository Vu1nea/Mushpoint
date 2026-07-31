---
target: Mushtrack Static Design/Goal Tracker.dc.html
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-07-31T16-54-06Z
slug: mushtrack-static-design-goal-tracker-dc-html
---
Method: dual-agent (A: a52a419e4cf7f3a46 · B: af4b04cc14ea52f19)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Streak heatmap cells beyond current streak are re-randomized on every render (`Math.random()>0.55`), so the app's core history view doesn't reflect real status |
| 2 | Match System / Real World | 2 | Drawer failure copy ("Network hiccup — your changes weren't saved") contradicts the product's own "local-first, no cloud sync" claim |
| 3 | User Control and Freedom | 2 | Goal deletion gates on a bare `window.confirm()`, cascades to subgoals/tasks, no undo; categories can be added but never renamed/removed |
| 4 | Consistency and Standards | 2 | Enter-to-submit works everywhere except Idea Vault's primary capture row; progress-ring color logic differs between Goals list, Project cards, and Subgoal bars |
| 5 | Error Prevention | 2 | Title validation is solid; destructive delete has only one generic confirm; nothing prevents duplicate category names |
| 6 | Recognition Rather Than Recall | 3 | Persistent filter chips and category color-coding help; idea tags have no autocomplete, inviting near-duplicates ("Gym"/"gym") |
| 7 | Flexibility and Efficiency of Use | 2 | No search, no command palette, no keyboard shortcuts beyond per-field Enter; Quick Add covers only 3 of 5 creatable item types |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained palette and consistent spacing/type pairing; Dashboard's 6 simultaneous panels and Goals list's 9 stacked filter chips are the clutter points |
| 9 | Error Recovery | 2 | Drawer failures get message + Retry; but filtering Goals to Completed/Archived renders a blank list with no empty-state message |
| 10 | Help and Documentation | 1 | No onboarding, no tooltips beyond bare icon `title` attrs, for an IA with three parallel "task" homes a first-timer has no way to learn |
| **Total** | | **21/40** | **Acceptable** |

*Mode: Operate (task-focused personal app UI) — all 10 heuristics apply; none scored n/a.*

## Design Specificity Verdict

**LLM assessment:** Not a relabeled generic SaaS dashboard — real product-specific logic is baked in, not just copy. The Vision Board auto-pulls a quote card and image card from every active goal's motivation text and its own image-slot, so a photo dropped on a Goal detail page appears on the Vision Board automatically with zero duplicate entry — a genuinely specific expression of the "unify instead of duplicate" premise. The Idea Vault's "Make Goal"/"Make Project" promotion flow encodes the bullet-journal-to-actionable pipeline the product is pitched on. That said, the screen furniture — sidebar nav, card-grid dashboard, kanban board, GitHub-style heatmap, drawer-based create forms — is standard productivity-app vocabulary, and a couple of the "specific" touches are undercut by internal contradictions (a local-first app simulating network failures). Net: specific in data model and cross-screen logic, generic in screen furniture.

**Deterministic scan:** `detect.mjs --json` ran clean (exit 2, findings present as expected). One finding: `layout-transition` at line 34 (sidebar `transition:width .25s ease` on collapse). Legitimate, not a false positive — width animation does cause reflow — but the fix is more involved than the rule's boilerplate suggestion implies, since the sidebar's content also needs to reflow (labels appearing/disappearing) when it collapses; a pure transform substitute isn't a drop-in swap here. Low severity, already a known/accepted tradeoff.

**Visual overlays:** Not available this run. Assessment B started a local server successfully but found no browser-automation tool registered in this session (only `WebFetch`, which can't execute JS, render the CDN-dependent React/Babel runtime, or screenshot). No live-rendering evidence, console errors, or injected-overlay findings could be collected — this is a session-capability gap, not a page-render failure. The server was stopped cleanly after the check.

## Overall Impression

The mockup's underlying logic is more thoughtful than its surface chrome — the Vision Board's auto-pull and the Idea→Goal/Project promotion path are real product ideas, not decoration. But the file undercuts its own "local-first, trustworthy personal tool" premise in two concrete ways: a fake 30%-chance "network" failure on every single create action, and a streak heatmap that re-randomizes on every render instead of reflecting real history. Those two things, plus an unstyled native `confirm()` on the single most destructive action in the app (deleting a goal), are the biggest opportunity — the app looks careful everywhere except at its highest-stakes and highest-trust moments.

## What's Working

1. **Vision Board auto-pull from Goal motivation/images** — reuses the goal's own image-slot ID and motivation text with zero duplicate data entry, directly enacting the product's core premise.
2. **Idea → Goal/Project promotion** — a concrete workflow for the bullet-journal-to-actionable-item arc, not something a generic to-do app would have.
3. **Category-coded progress rings** reused consistently across Dashboard and Goals list give at-a-glance recognition of life area — undercut somewhat by a 3-color cycle repeating across 5 categories (see Minor Observations).

## Priority Issues

**[P0] Goal deletion is unstyled, browser-native, and irreversible.**
- **Why it matters:** This is the highest-stakes action in a tool tracking months of personal progress, and it gets the least design attention — a plain `window.confirm()`, no soft-delete, no undo.
- **Fix:** Replace with an in-system confirmation modal matching the drawer's visual language, plus a 5–10s "Goal deleted — Undo" toast before permanent removal.
- **Suggested command:** `/impeccable harden`

**[P1] Simulated "network" failures contradict the product's local-first identity.**
- **Why it matters:** Every drawer submission has a hardcoded 700ms delay and a 30% "Network hiccup" failure, while Settings states "local-first, no cloud sync" — this actively teaches the wrong mental model of where data lives and why it might fail.
- **Fix:** Remove the simulated failure, or reframe the error copy/cause around real local-first failure modes (disk full, permission denied).
- **Suggested command:** `/impeccable clarify`

**[P1] Streak history is partially fabricated on every render.**
- **Why it matters:** Streaks are the app's core habit-tracking payoff; heatmap cells beyond the current streak are set by `Math.random()` on every render, so the visualization isn't derived from real history — a user will notice it change on reload and stop trusting it.
- **Fix:** Derive heatmap cells from actual historical completion records.
- **Suggested command:** `/impeccable harden`

**[P2] No empty states for zero-result filters.**
- **Why it matters:** Goals list "Completed"/"Archived" chips are real and clickable, but no seed goal has either status, so selecting them renders a silent blank area — reads as broken, not empty.
- **Fix:** Add a shared empty-state component ("No archived goals yet") reused across Goals, Ideas, and Vision Board.
- **Suggested command:** `/impeccable onboard`

**[P2] Filter overload at the top of the Goals list.**
- **Why it matters:** Status chips (3) stacked directly above category chips (6) put 9 toggle buttons in front of the user before any content — more than double the ≤4-visible-choice guideline at the screen's first decision point.
- **Fix:** Keep status chips primary/always-visible; move category filtering into a compact dropdown.
- **Suggested command:** `/impeccable layout`

## Persona Red Flags

**Alex (Power User):** No search or command palette; no keyboard shortcuts beyond per-field Enter. Dashboard Quick Add covers only Idea/Task/Goal — creating a Project or Vision item requires navigating away. The artificial 700ms delay + 30% failure on every drawer submit means an Alex rapid-firing several new tasks will statistically hit multiple failures requiring manual Retry — a direct tax on exactly the behavior this persona exhibits.

**Sam (Accessibility-Dependent):** Every task checkbox hides the real `<input type=checkbox>` at `opacity:0` behind a decorative span, and a global rule strips the native focus outline (`input:focus,textarea:focus,select:focus{outline:none}`) with no replacement style on the checkbox or its sibling — a keyboard user tabbing through tasks gets zero visible focus indication. Icon-only buttons (goal Edit/Delete, drawer close, sidebar theme toggle) rely solely on a `title` attribute — no `aria-label` anywhere in the file, so screen-reader announcement is unreliable.

**Riley (Stress Tester):** Goal-detail title and kanban card titles have no `max-width`/overflow handling, so a long title would balloon the sidebar or a kanban card indefinitely. The 30% save-failure roll gives a stress tester retrying a non-trivial chance of several consecutive failures with no backoff.

## Minor Observations

- `taskFilterChips` (status/recurring/standalone filters) is fully computed with click handlers but never rendered anywhere on the Tasks page — dead code, and a missing way to isolate recurring vs. standalone tasks on the one screen where that distinction matters most.
- Category color assignment cycles only 3 accent colors across 5+ categories, so two categories (e.g. "Work" and "Side Projects") land on the same color — weakens the category-color recognition the rest of the UI depends on.
- The warning color is reused for both blocking form-validation errors and routine "Overdue" due-date labels — same alarm color for two different severities.
- Only one subgoal (`sg1`) defaults to expanded among otherwise-equal subgoals — an arbitrary, unexplained default.
- Settings' category rows have no rename/delete/reorder — a one-way door once a category is created.
- Detector: `layout-transition` on the sidebar's `width` transition (line 34) — legitimate but low-severity; already a known/accepted tradeoff given the sidebar's content also needs to reflow on collapse.

## Questions to Consider

1. If Mushpoint is truly local-first with no cloud sync, why does every create/edit action simulate a networked 30%-failure save — what would the UI look like if it trusted local writes and reserved error states for things that can actually happen offline?
2. With three parallel "task" containers (subgoal task, project task, standalone/recurring task), what happens when one real task belongs conceptually to two at once — e.g. a gym task that's both a Goal subgoal item and a recurring streak?
3. The Vision Board already auto-pulls from Goal motivations specifically to avoid duplicate data entry — should Streaks or Tasks get the same treatment on the Dashboard, or is manual re-entry expected everywhere else?
