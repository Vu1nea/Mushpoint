# Mobile responsiveness plan

Goal: the web app (`app/`, SvelteKit 2 + Svelte 5 runes + Tailwind 4) works well at 375px phone width up to desktop.

## Decisions

- Mobile-first Tailwind. `md` (768px) is the shell breakpoint: below it, phone layout; at/above, current desktop layout unchanged.
- Phone navigation: **bottom tab bar** with the five main screens (Dashboard, Goals, Tasks, Ideas, Vision) plus a slim top bar (logo, page title, menu button). The menu opens a slide-in sheet holding Settings, user, theme toggle, credits.
- Calendar on phones: keep the month grid, show compact dots instead of task chips, and list the selected day's tasks under the grid.
- Drag-and-drop on touch: **not now**. Ship non-drag alternatives first ("Move to…" menu on Kanban cards; calendar tasks re-dated through the task drawer). Pointer-event touch drag is a later phase.

## Phases

### 1. App shell (`+layout.svelte`, `app.html`)
- Below `md`: hide sidebar; top bar + bottom tab bar; menu sheet with backdrop, Escape to close, focus handling, closes on route change.
- From `md` up: current sidebar unchanged; saved collapsed state applies only there.
- `h-screen` → `h-dvh`; main padding `px-4 pt-5 md:px-11 md:pt-9`; bottom padding clears the tab bar; safe-area insets (`viewport-fit=cover`).

### 2. Page layouts
- Page headers (Goals, Tasks, Ideas, Vision, Goal detail, Settings): title + action wrap/stack below `sm`; heading scales down.
- Dashboard stacks cleanly below `lg`; goal detail side panel full width and non-sticky on phones; settings has no overflow at 375px.

### 3. Components
- `FormModal` → bottom sheet below `md` (full width, rounded top, `max-h-[90dvh]`, scrolling body, sticky footer).
- `ConfirmDialog`, `GoalCompleteCelebration` checked at 375px.
- `CalendarView` → grid with dots + selected-day list on phones; day popover → bottom sheet on phones.
- `GanttChart` → title above bar below `md`.
- `KanbanBoard` → one column at a time via `Tabs` below `md`; "Move to…" menu on each card.

### 4. Touch
- Hover-only actions always visible on coarse pointers (`pointer-coarse:` variant).
- Icon buttons get ≥40px hit area on coarse pointers.
- Inputs ≥16px font on phones (stops iOS focus zoom).
- Tooltips reachable by tap/focus.

### 5. Tests
- Playwright projects for `iPhone 13` and `Pixel 7`.
- No-horizontal-overflow check at 375px on each main page.

### Later
- Touch drag (pointer events) for Kanban and Calendar.
- `mushpoint-design` popovers (DatePicker, Select) audit at 375px — separate repo.
