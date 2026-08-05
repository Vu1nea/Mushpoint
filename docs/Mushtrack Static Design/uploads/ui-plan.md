# Goal Tracker — Dashboard UI Shell

A static, visual-first web build of the desktop app's interface: sidebar navigation, all main screens laid out with realistic sample data, Nocturne (dark) as the default theme with Coquette (light) switchable in Settings. No database, no real CRUD — this pass is about proving the layout and information hierarchy before behavior gets built.

## Navigation

Persistent left sidebar, collapsible to an icon rail:

- Dashboard
- Goal Tracker
- Project Manager
- Task Manager
- Idea Vault
- Vision Board
- Settings

Each is its own route so pages are independently linkable.

## Screens

### Dashboard
Bento-style grid, denser toward the top:
- **Active goals** — progress bars grouped by category, largest block
- **Vision board preview** — top-right tile, 2x2 image mosaic, click-through to the full board
- **Today's tasks** — checklist, recurring habits flagged
- **Streaks** — current/longest counters plus a GitHub-style contribution heatmap strip
- **Upcoming** — merged due-date feed of goals, subgoals and tasks with overdue styling
- **Quick add** — single input with a type toggle (idea / task / goal)

### Goal Tracker
List view of goals grouped by category, each row showing timeframe chip (short/mid/long), due date, and progress ring. Clicking a goal opens a detail page: motivation panel (text + image) on the left, subgoal accordion on the right where each subgoal expands to its tasks and contributes its partial average to the parent bar.

### Project Manager — recommended direction
Projects index as a card grid: name, parent goal link, progress ring, task counts per column, next due date.

Project detail uses **a kanban board as the default view with a Targets rail above it**. The rail is a horizontal strip of target chips, each with its own mini progress bar; clicking a target filters the board to only that target's cards. This keeps one board (rather than one board per target) while still making the target structure visible and navigable. A view toggle offers **Board / List / Timeline**, with List being the flat task table and Timeline a simple due-date lane.

Rationale: nesting a kanban inside each target fragments the work and hides cross-target flow. Filtering one board preserves the "where does everything stand" read that kanban is good at.

### Task Manager
Flat table across all goals and projects: status, title, linked parent (goal/subgoal/project/target), due date, recurring flag. Filter chips by status, link type, and recurrence.

### Idea Vault
Masonry of short note cards with tags, a persistent quick-capture input pinned to the top, and a promote action on each card offering "Make Goal" or "Make Project".

### Vision Board
Masonry grid mixing goal motivation images, idea cards, and standalone quotes. Filter bar for category / goal / most recent. Items are auto-arranged — no manual dragging, per the plan.

### Settings
Theme picker showing Nocturne and Coquette as swatch previews, plus placeholder sections for categories, streak grace period, and data export so the shape is visible.

## Notes on the UI you described

Everything you described reads as intuitive. Two small adjustments:

1. **Vision board at top-right of the dashboard** works well as a *preview tile*, but the full board deserves its own sidebar entry too — a board is browse-heavy and a dashboard tile can't hold enough of it.
2. **Task Manager wasn't in your sidebar list** but is a core section in the plan document, with tasks existing independently of goals. Including it avoids tasks being reachable only by drilling into a goal.

## Motion and loading

Animation is part of the personality, not decoration on top:

- **Progress bars and rings** animate from 0 to their value on mount with a spring easing, staggered by a few ms per row so a category list fills in as a cascade rather than all at once. Value changes tween rather than jump.
- **Streak heatmap** cells fade/scale in left-to-right on first paint.
- **Cards and list rows** (goals, projects, ideas, tasks) enter with a short fade-and-rise stagger; hover gives a subtle lift and border-accent shift.
- **Route transitions** cross-fade the main content area while the sidebar stays fixed.
- **Checkboxes** get a check-draw plus a brief strike-through sweep on the task label; completing the last task in a subgoal pulses the parent progress bar.
- **Kanban cards** animate position when filtered by a target chip instead of snapping.
- **Theme switch** cross-fades colors rather than hard-cutting.
- **Sidebar collapse** animates width with labels fading out.
- **Loading states**: a branded circular spinner (accent-colored ring) as the app-level loader on first mount and route load, plus skeleton shimmer placeholders for card grids and lists so the layout doesn't jump. Both respect `prefers-reduced-motion`, which drops all of the above to instant transitions.

## Themes

### Nocturn
| Swatch | Hex | Role |
|---|---|---|
| Very dark navy | `#14152B` | Background |
| Dark navy | `#1F2147` | Surface |
| Muted indigo | `#3A3768` | Border / muted |
| Light lavender | `#9C9EE8` | Text secondary |
| Near-white lavender | `#F2F1FB` | Text primary |
| Medium purple | `#7B6FC4` | Primary accent |
| Teal/turquoise | `#4FD1C5` | Secondary accent |
| Sky blue | `#5BA8D4` | Tertiary accent (cyan) |

### Coquette
| Swatch | Hex | Role |
|---|---|---|
| Off-white blush | `#FFF8F5` | Background |
| Pure white | `#FFFFFF` | Surface |
| Pale pink | `#F2D4DA` | Border / muted |
| Dusty rose | `#B85C73` | Text secondary |
| Deep plum-brown | `#4A2E33` | Text primary |
| Rose pink | `#E8879F` | Primary accent |
| Sage green | `#9CB88A` | Secondary accent |
| Lilac | `#C9A8D4` | Tertiary accent |

## Technical approach

Built directly in SvelteKit, matching the real Tauri + SvelteKit desktop stack — no React prototype layer, no port step later.

- SvelteKit routes under `src/routes/`, one route per sidebar item, using `+layout.svelte` for the persistent sidebar shell.
- Tailwind v4 tokens in `src/app.css`: Nocturne on `:root`, Coquette under a `.theme-coquette` class, all colors as semantic tokens (background, surface, border, text, primary/secondary/tertiary accent) converted from the supplied hex values to oklch. No hardcoded colors in components.
- Theme selection held in a Svelte store (`src/lib/stores/theme.ts`), persisted to localStorage, applied via a class on `<html>` set in `+layout.svelte`.
- Icons resolved through a small `Icon.svelte` wrapper (`name` prop) so per-theme icon sets can swap later without touching components.
- Sample data as typed fixtures in `src/lib/data/`, shaped to the plan's schema (Category, Goal, Subgoal, Task, Streak, Project, Target, Idea) so wiring real storage later is a swap, not a rewrite.
- Progress values computed by the plan's averaging rule from the fixtures rather than hardcoded, so bars stay self-consistent.
- Route-level `<svelte:head>` metadata per page.
- Motion handled with CSS keyframes/transitions plus Svelte's built-in transition/motion primitives (`transition:`, `animate:flip`, spring/tweened stores) for stagger and layout animation; all timings and easings defined as tokens.
