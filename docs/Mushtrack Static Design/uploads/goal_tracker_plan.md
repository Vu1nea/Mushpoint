# Goal Tracker Dashboard — Project Plan

**Goal:** A desktop app for creating goals, breaking them into actionable pieces, and quantifying progress toward meeting them.

**Platform:** Desktop app (Windows + macOS), local-first — no cloud sync or accounts in v1.

---

## 1. Tech Stack

**Tauri + SvelteKit + Tailwind + SQLite**

- **Tauri** — wraps the frontend in a lightweight native shell using the OS's built-in webview (WebView2 on Windows, WKWebView on macOS) instead of bundling Chromium. Installers come out to roughly 3–10MB, versus 100–150MB+ for an equivalent Electron app, with no separate runtime to install on either OS.
- **SvelteKit** — no virtual DOM, minimal boilerplate for the many small reactive UI pieces this app needs (progress bars, streak counters, kanban cards), and has an official Tauri template.
- **Tailwind** — utility CSS, pairs well with the theming approach in Section 5.
- **SQLite** — a single local database file. Zero server setup, and trivially easy to back up (it's just a file to copy).

**Distribution:** shipped unsigned for v1 (no code-signing certificate). Users will see the standard "unidentified developer" / SmartScreen warning on first launch, which is an accepted tradeoff for now. Windows and macOS builds are produced via a GitHub Actions workflow (Windows + macOS runners) so both installers are built and published automatically on release, without needing two physical machines.

---

## 2. Goal-Tracking Approach

The design borrows from a few established methodologies rather than inventing one from scratch:

- **SMART goals** — informs the Goal fields (specific description, due date, category).
- **OKRs** — Goal = Objective, Subgoal = Key Result. Basis for the Goal → Subgoal relationship and progress percentage.
- **Habit tracking** — basis for recurring tasks and streak counters.
- **Kanban** — basis for the Project Manager board.
- **Bullet journaling** — basis for the low-friction Ideas Storage inbox.

---

## 3. Data Model

```
Category (School, Gym, Work, Side Projects, Social, +custom)
  └── Goal (short / mid / long term)
        ├── due date (optional)
        ├── motivation / inspiration (text and/or image)
        ├── progress % — auto-calculated (see rule below)
        ├── Subgoal (flat — no nested subgoals)
        │     ├── due date (optional)
        │     ├── can be AI-generated (Phase 2)
        │     └── Task (multiple)
        └── Task (directly linked — no subgoal wrapper required)

Project (Project Manager)
  ├── optionally linked to a parent Goal
  ├── progress % — auto-calculated, same rule as Goals
  ├── kanban view of all its tasks (To Do / In Progress / Done)
  └── Target (same table as Subgoal, flat — no sub-targets)
        └── Task (multiple)

Task (shared entity — lives in Task Manager)
  ├── optionally linked to a Goal, Subgoal, Project, or Target
  ├── recurring flag → if true, tracks a Streak
  └── status (todo / in progress / done)

Streak (attached to a recurring Task)
  ├── current streak count
  ├── longest streak count
  └── grace period: 2 days, global default (missing up to 2 days doesn't reset the streak)

Idea (Ideas Storage)
  ├── freeform, unlinked by default
  └── "Promote to Goal" or "Promote to Project" action converts it

Settings (single local row — no multi-user support needed)
  └── active_theme (which pre-built theme is currently selected)
```

**Design notes:**
- Task and Subgoal/Target are shared entities reused across Goals and Projects, rather than building parallel systems for structurally identical concepts.
- **Progress calculation rule:** a Goal's (or Project's) progress is the average completion across all of its direct children — subgoals/targets and directly-linked tasks all count as equal-weight units. A subgoal's own completion is the average of its tasks, so a half-done subgoal contributes 0.5 to its parent rather than a flat 0 or 1. This keeps progress bars moving smoothly instead of jumping in large steps.

---

## 4. Feature Breakdown

### Core
- [ ] Create/edit/delete Goals (short/mid/long term)
- [ ] Categories (default 5 + user-created custom categories)
- [ ] Subgoals (flat, not nested), each with its own due date, completion state, and multiple linked tasks
- [ ] Goal progress auto-calculated from subgoal/task completion
- [ ] Motivation/inspiration field per goal — supports text and/or image
- [ ] Due dates on goals + subgoals, with overdue indicators

### Task Manager
- [ ] Standalone task list (todo / in progress / done)
- [ ] Optional linking to a Goal, Subgoal, or Project
- [ ] Recurring task flag

### Task Streaks
- [ ] Streak counter tied to recurring tasks
- [ ] Current streak + longest streak tracked
- [ ] Grace period — 2 days, global default across all recurring tasks
- [ ] Visual indicator (calendar heatmap style, à la GitHub contributions)

### Project Manager
- [ ] Kanban board per project (To Do / In Progress / Done, or custom columns)
- [ ] Optional link to a parent Goal
- [ ] Project Targets (same structure as Subgoals — flat), each with their own tasks
- [ ] Project-level progress % — auto-calculated, same rule as Goals

### Ideas Storage
- [ ] Quick-capture inbox, minimal friction (title + note)
- [ ] Tagging/categorizing
- [ ] "Promote to Goal/Project" action

### Vision Board
- [ ] Fixed grid/masonry layout — items auto-arranged, no manual positioning
- [ ] Auto-pulls in motivation images/text already attached to Goals as grid items
- [ ] Can also pull from Ideas Storage, or accept direct image/quote uploads
- [ ] Sort/filter options (by category, by goal, most recent)

### Theming
- [ ] Multiple pre-built themes — color palette + icon set per theme (no layout/formatting differences for v1)
- [ ] Theme picker in settings; selection persisted locally
- [ ] Icons swap per theme, not just colors

### Data & Backup
- [ ] Auto-export full data to JSON once per week
- [ ] Retention: single most recent snapshot only (each export overwrites the last)

### Dashboard
- [ ] Overview of active goals with progress bars, grouped by category or timeframe
- [ ] Upcoming due dates (goals + subgoals + tasks) in one view
- [ ] Streak widget (today's habits + current streaks)
- [ ] Today's tasks
- [ ] Quick-add for idea/task/goal without leaving the dashboard
- [ ] Quick link/preview of the Vision Board

### Phase 2: AI Integration (nice-to-have, after core works)
- [ ] Claude generates suggested subgoals from a goal description
- [ ] Claude suggests categorization for ideas
- [ ] Possible: weekly digest/summary of progress generated by Claude

---

## 5. Theming Architecture

Since every screen needs to respect whichever theme is active, this is set up in Phase 0 — before component styling exists to retrofit:

1. **Colors as CSS custom properties** (e.g. `--color-accent`, `--color-bg`) rather than hardcoded hex values in components. Swapping a theme means swapping which set of variables is loaded.
2. **Icons referenced by logical name** (e.g. `icon="goal"`) through a small wrapper component that resolves the actual SVG for the active theme, rather than importing specific icon files directly in each component.

Retrofitting either of these after components already have hardcoded colors and direct icon imports baked in is real, avoidable rework — hence doing it first.

---

## 6. Distribution & Getting Started

Rust, Node, npm, and the Tauri CLI are build-time dependencies only — needed by the developer, never by the end user. The build command compiles everything into a single native installer per OS (.msi/.exe for Windows, .dmg/.app for macOS), with Rust compiled directly into the binary rather than installed as a separate runtime. End users just download the installer and double-click it.

The end-user flow is: **download → run installer → open app.** No dev tools, no extra downloads (WKWebView ships with macOS; WebView2 is preinstalled on virtually all modern Windows machines).

---

## 7. Build Order

| Phase | Focus |
|---|---|
| **0** | Finalize tech stack, scaffold Tauri + SQLite project, set up basic window, define the color-variable/icon-wrapper theming system |
| **1** | Data model + CRUD for Goals, Categories, Subgoals (no UI polish yet) |
| **2** | Task Manager + linking tasks to goals/subgoals |
| **3** | Streaks (build on top of recurring tasks) |
| **4** | Project Manager (kanban, reusing Task entity) |
| **5** | Ideas Storage + promote-to-goal/project flow |
| **6** | Vision Board (reuses image assets from Goals/Ideas) |
| **7** | Dashboard — pull everything into one polished view |
| **8** | Build out the theme picker + additional themes (mostly content work by now) |
| **9** | AI integration (Claude subgoal generation, etc.) |

Phases 1–6 are mostly backend/data-model work with minimal UI polish; the bulk of visual design effort lands in Phases 7–8.

---

## 8. Explicitly Out of Scope for v1

- Multi-device sync / cloud hosting
- User accounts / auth
- Mobile app
- Code signing / notarization
- AI features (deferred to Phase 9)
