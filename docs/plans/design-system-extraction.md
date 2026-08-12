# Extract Mushpoint's design system into a shared package

## Context

Mushpoint's Tailwind v4 setup already has a real design system: CSS custom-property
tokens for both themes (`nocturne`/`coquette`), a type scale, radii, motion tokens,
and a set of framework-level UI primitives (buttons, chips, selects, date pickers,
drawers, etc.) built on those tokens. The user maintains two other side projects on
**different frameworks** and wants the same look-and-feel (and, where the framework
allows it, the same components) across all three instead of re-deriving the palette
and control styling from scratch each time.

Since the other two projects don't share a framework, not everything can move as-is.
The plan below splits Mushpoint's `src/lib` into three tiers by portability, and
proposes a new standalone package as the single source of truth — Mushpoint itself
will be migrated to consume it too, so nothing drifts between "the design system"
and "what Mushpoint actually renders."

## What exactly moves

### Tier 1 — Design tokens (pure CSS, works in any Tailwind v4 project, any framework)
Source: `app/src/lib/styles/theme.css`, `app/src/lib/assets/fonts/*.woff2`
- Color tokens for both themes + `--mp-warn`
- `@theme inline` mapping to semantic utilities (`bg-surface`, `text-muted`, `rounded-control`, …)
- Type scale (`--text-2xs` … `--text-lg`), `--radius-control`, `--radius-card`
- Motion tokens (`--mp-duration-*`, `--mp-ease-*`), the `@property --mp-ring-angle` (needed for `ProgressRing`)
- Keyframes + `.mp-enter/.mp-pop/.mp-pulse/.mp-shake/.mp-spin` utility classes, `prefers-reduced-motion` overrides
- The two Bricolage Grotesque / Hanken Grotesk `.woff2` files + `@font-face` blocks
- Scrollbar styling

This is a straight copy — nothing here references Svelte or the app's data layer.

### Tier 2 — Pure logic utilities (plain TS/JS, no DOM/framework dependency)
Source: `app/src/lib/{motion.ts, selectOptions.ts, calendarGrid.ts}`, `app/src/lib/components/ui.ts`, part of `app/src/lib/format.ts`
- `motion.ts` — `motion()`, `stagger()` (reduced-motion-aware duration helper)
- `selectOptions.ts` — pure option/group flattening helpers for a select-style control
- `calendarGrid.ts` — pure month-grid math for a date picker
- `ui.ts` — `button`, `chip()`, `segment()`, `field`, `sectionHeading`, `lift` class-string builders. **Drop** `DUE_CLASSES`/the `DueTone` import — that's goal-tracker domain logic, not design system, and stays in Mushpoint.
- `format.ts`, generic subset only — `percent`, `parseDate`, `formatDate`, `daysUntil`, `isOverdue`. **Leave behind** `dueTone`, `dueLabel`, `cellTitle`, `weeklyAnchorLabel` (goal/habit-tracking domain logic that imports Mushpoint's own API types).

These work unmodified in React or any other Tailwind consumer since they're plain functions returning strings/values.

### Tier 3 — Svelte components (portable as-is only to the sibling Svelte project)
Source: `app/src/lib/components/{Icon,Tooltip,Checkbox,Select,DatePicker,Drawer,ConfirmDialog,ErrorBanner,ProgressBar,ProgressRing,TagInput}.svelte`, `app/src/lib/popover.svelte.ts`, generic subset of `app/src/lib/icons/index.ts`
- These are genuine UI primitives with no goal/task/vision-board business logic baked in.
- `popover.svelte.ts` is the shared floating-panel mechanics (`Select`/`DatePicker` both use it) — moves alongside them.
- `icons/index.ts`: keep the generic icon set (`check`, `close`, `calendar`, `chevron-*`, `warning`, `spinner`, `plus`, `minus`, `edit`, `trash`, `github`, `sidebar`); leave Mushpoint-specific icons (`dashboard`, `goal`, `project`, `task`, `idea`, `vision`, `flame`) in the app.

**For the Svelte sibling project:** consume these files directly.
**For the non-Svelte project:** these `.svelte` files serve as the reference spec — rebuild the same visual/behavioral contract (props, ARIA roles, keyboard nav) natively in that framework, but have the rebuilt components consume Tier 1/2 (the CSS classes and `ui.ts`/`motion.ts` helpers) so they render identically. This is manual, one-time work per component, not automated.

### Explicitly NOT extracted (stays in Mushpoint only)
- `theme.svelte.ts` — the *pattern* (`THEMES`/`THEME_LABELS`/`THEME_PREVIEWS` shape + `data-theme` attribute switching) is worth copying by hand into each project's own theme store, but the file itself is wired to Mushpoint's SQLite-backed settings API and shouldn't move verbatim.
- `theme/category.ts` — goal-category business logic.
- All domain components: `TaskRow`, `GoalDrawer`, `IdeaDrawer`, `VisionBoard`, `VisionItemDrawer`, `VisionImage`, `KanbanBoard`, `SubgoalCard`, `StreakCard`, `StreakHeatmap`, `GoalStatusSegment`, `GoalCompleteCelebration`, all `Dashboard*.svelte`.

## Package structure

New standalone repo (not nested inside Mushpoint), e.g. `mushpoint-design/`:

```
mushpoint-design/
  package.json
  css/
    theme.css
    fonts/bricolage-grotesque-latin.woff2
    fonts/hanken-grotesk-latin.woff2
  utils/
    ui.ts
    motion.ts
    format.ts          # generic subset only
    selectOptions.ts
    calendarGrid.ts
  icons/
    index.ts            # generic subset only
  svelte/
    Icon.svelte
    Tooltip.svelte
    Checkbox.svelte
    Select.svelte
    DatePicker.svelte
    Drawer.svelte
    ConfirmDialog.svelte
    ErrorBanner.svelte
    ProgressBar.svelte
    ProgressRing.svelte
    TagInput.svelte
    popover.svelte.ts
```

Distribution: given this is a personal, non-published side project, install it as a
git dependency (`npm install git+ssh://...mushpoint-design.git`) rather than
publishing to the npm registry — no npm org/account management needed, and each
project can pin a commit/tag.

**Decided:** build it first as `packages/design` inside this repo — easier to iterate
and test against real Mushpoint source in place. Once the three tiers are built and
verified working (Mushpoint consuming it via a local/workspace import), split it out
with `git subtree split --prefix=packages/design` to preserve file history for the
extracted paths, push that to the new standalone `mushpoint-design` repo, then switch
Mushpoint's import to the git dependency form described above.

## Branching (gitflow)

Each feature below gets its own `feature/<name>` branch off `dev`, merged back to
`dev` when done (never straight to `main`):

In the new `mushpoint-design` repo:
- `feature/design-tokens-package` — Tier 1 CSS + fonts, package scaffold
- `feature/design-utils-package` — Tier 2 pure utilities
- `feature/design-svelte-primitives` — Tier 3 Svelte components + popover

In the Mushpoint `app` repo:
- `feature/consume-design-tokens` — point `layout.css` at the package, delete local
  `theme.css`/fonts
- `feature/consume-design-components` — replace local `ui.ts`/`motion.ts`/etc. and
  the Svelte primitive files with package imports, keep app-specific bits local

## Migrating Mushpoint to consume it

Once the package exists, point Mushpoint's own imports at it instead of the local
copies, so it becomes the canonical source rather than a fork:
1. `npm install` the new package into `app/`.
2. `app/src/routes/layout.css`: replace the local `theme.css` import with the
   package's.
3. Delete `app/src/lib/styles/theme.css`, `app/src/lib/assets/fonts/*` and repoint
   any remaining reference to them.
4. Replace `app/src/lib/components/{Icon,Tooltip,Checkbox,Select,DatePicker,Drawer,
   ConfirmDialog,ErrorBanner,ProgressBar,ProgressRing,TagInput}.svelte` and
   `app/src/lib/popover.svelte.ts` with re-exports from (or direct imports of) the
   package equivalents.
5. Replace `app/src/lib/components/ui.ts`'s portable exports with imports from the
   package, keeping only `DUE_CLASSES`/`DueTone` local. Same split for `format.ts`
   (generic fns from the package, `dueTone`/`dueLabel`/`cellTitle`/
   `weeklyAnchorLabel` stay local).
6. Merge the generic subset of `icons/index.ts` from the package with Mushpoint's
   remaining app-specific icons (e.g. re-export-and-extend, or keep one local
   `IconSet` that spreads the package's base set plus Mushpoint's additions).

## Verification

- `npm run check` and `npm run build` in `app/` after the migration — confirms no
  broken imports and Tailwind still picks up the token layer from the new location.
- Manually run the Mushpoint app (`npm run dev` / `npm run tauri dev`) and visually
  diff a few screens (dashboard, a goal drawer, the settings theme picker) against
  current `main` to confirm nocturne/coquette still render identically post-migration.
- Existing unit tests (`format.spec.ts`, `calendarGrid.spec.ts`, `selectOptions.spec.ts`,
  `kanban.spec.ts`, `dashboard.spec.ts`) should still pass once split between the
  package and the app — run `npm test`.
