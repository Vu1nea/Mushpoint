# Goal Tracker Dashboard — Project Plan (v1 Revised)

**Goal:** A desktop app for creating goals, tracking habits, breaking objectives into actionable tasks, and quantifying progress toward meeting them.

**Platform:** Desktop app (Windows + macOS), local-first architecture. 

**Note:** When implementing, always follow coding and formatting best practices. Use modular components and functions to keep code readable and maintain DRY principles.

---

## 1. Tech Stack & Architecture

**Tauri + SvelteKit + Tailwind + SQLite**

- **Tauri** — Wraps the frontend in a lightweight native shell using the OS's built-in webview (WebView2 on Windows, WKWebView on macOS) instead of bundling Chromium. Installers come out to roughly 3–10MB. Rust handles native IPC calls and file operations.
- **SvelteKit** — No virtual DOM, minimal boilerplate for reactive UI pieces (progress bars, streak counters, kanban cards).
- **Tailwind** — Utility CSS paired with CSS custom properties for theme swapping.
- **SQLite** — Embedded local database file managed by Rust. Zero server setup, microsecond read/write speeds, and simple file-based backup.
- **Cloud Sync Path (v2 / Optional):** Local-first architecture allows adding background sync via **PowerSync / Supabase** or **Turso** in future releases without changing the local-first speed for single-device offline usage.

**Distribution:** Shipped unsigned for v1 (no code-signing certificate). Windows and macOS builds are produced via a GitHub Actions CI pipeline.

---

## 2. Core Concepts & Methodology

The app blends established methodologies into a unified workflow:

- **SMART Goals & OKRs:** Goals serve as Objectives; Subgoals serve as Key Results with auto-calculated progress.
- **Habit Tracking:** Recurring tasks feed into streak counters with grace periods.
- **Kanban View Layer:** Kanban boards are rendered as **views over Goal tasks**, not as a separate, isolated project management engine.
- **Bullet Journaling:** Low-friction Ideas Storage inbox for quick capture.

> 💡 **Architectural Pivot: Standalone Project Manager Removed**  
> Rather than maintaining a separate `Project Manager` module with duplicate `Project Task` tables, software projects and complex objectives are modeled directly as **Goals**. Toggling a Goal into "Kanban View" renders its tasks as interactive cards. This eliminates data duplication while giving CS/engineering projects a full Kanban workflow.

---

## 3. Unified Data Model

All database IDs use **UUIDs** (`id TEXT PRIMARY KEY`) to prevent primary key collisions and keep data ready for eventual cloud sync.

```
Category (School, Gym, Work, CS Projects, Social, +custom)
  └── Goal (short / mid / long term)
        ├── due date (optional)
        ├── motivation / inspiration (text and/or image)
        ├── repo_url (optional — for CS/Code projects to open GitHub/GitLab directly)
        ├── progress % — auto-calculated from child completion
        ├── status: active / completed / archived
        ├── Subgoal (flat — no nested subgoals)
        │     ├── due date (optional)
        │     └── Task (linked to Goal & Subgoal)
        └── Task (directly linked to Goal — no subgoal wrapper required)

Task (Single Source of Truth for Execution)
  ├── goal_id (optional FK)
  ├── subgoal_id (optional FK)
  ├── title, description, due_date
  ├── status: todo / in_progress / done
  └── is_recurring (flag) ──► Streak (current count, longest count, 2-day grace period)

Idea (Ideas Storage)
  ├── freeform title + note
  └── "Promote to Goal" action converts an idea into a Goal

Settings (single local row)
  └── active_theme (selected theme ID)
```

### Architectural & Design Notes:
1. **Unified Task Model:** There are no separate "Project Tasks." All actionable items across the app live in a single `tasks` table. Whether viewed on a daily checklist or drag-and-dropped on a Kanban board, tasks share the exact same status lifecycle (`todo` → `in_progress` → `done`).
2. **Kanban as a Goal View:** CS projects and complex goals do not need a separate database entity. Switching a Goal to "Kanban View" simply renders that Goal’s tasks as cards across status columns.
3. **Goal Progress Rule:** A Goal’s progress percentage is the average completion across all of its child elements (subgoals and direct tasks count as equal weights). A subgoal's completion is the average of its own tasks.
4. **Goal Status vs. Progress:** `progress` is an auto-calculated metric; `status` (`active`, `completed`, `archived`) is an explicit, user-controlled flag. Completed/archived goals drop out of active views into a filter.

---

## 4. Feature Breakdown

### Core & Goal Engine
- [ ] Create/edit/delete Goals with Categories (5 defaults + custom)
- [ ] Explicit Goal lifecycle states (`active`, `completed`, `archived`)
- [ ] Optional `repo_url` field for CS projects with direct launch buttons
- [ ] Subgoals (flat, non-nested) with independent due dates
- [ ] Auto-calculated Goal progress bars
- [ ] Motivation/inspiration field per goal (supports text and local image paths)
- [ ] Goal View Modes: Toggle between **List View** and **Kanban Board View**

### Unified Task Manager
- [ ] Central task engine filtered by `todo`, `in_progress`, `done`
- [ ] Optional linking to Goal or Subgoal
- [ ] Quick-add floating interface on Dashboard

### Habit Streaks
- [ ] Recurring flag on tasks
- [ ] Current streak + longest streak counters
- [ ] 2-day global default grace period
- [ ] Contribution heatmap / calendar visualization

### Ideas Storage
- [ ] Quick-capture inbox (title + markdown note)
- [ ] Tagging & filtering
- [ ] "Promote to Goal" action

### Vision Board
- [ ] Masonry/grid layout auto-arranged
- [ ] Auto-pulls motivation images and text from active Goals & Ideas
- [ ] Direct image/quote drop-in support
- [ ] Filter by category or goal

### Theming Architecture
- [ ] CSS Custom Properties (`--color-bg`, `--color-accent`) for runtime swapping
- [ ] Central SVG Icon Wrapper mapping logical names (`icon="github"`, `icon="goal"`) to theme-specific asset sets
- [ ] Theme switcher in Settings menu

### Data & Security
- [ ] Local JSON export/import for manual backups
- [ ] Local SQLite file storage in OS app data directory

### Dashboard
- [ ] Overview of active goals with progress bars
- [ ] Cross-app upcoming due dates widget
- [ ] Today's habits & active streak trackers
- [ ] Today's task list
- [ ] Vision Board preview link

---

## 5. Build Order

| Phase | Focus |
|---|---|
| **0** | Scaffold Tauri + SvelteKit + SQLite, implement CSS custom properties & Icon Wrapper |
| **1** | SQLite schema setup & CRUD for Categories, Goals, and Subgoals |
| **2** | Central Task Manager + linking tasks to Goals/Subgoals |
| **3** | Habit Streak engine (built into recurring tasks) |
| **4** | Goal Kanban View (rendering Goal tasks in drag-and-drop column layout) |
| **5** | Ideas Storage + "Promote to Goal" conversion workflow |
| **6** | Vision Board asset aggregation |
| **7** | Dashboard integration |
| **8** | Theme expansion & polish |
| **9** | Phase 2: Local AI integration (Claude API key for subgoal suggestions & idea parsing) |

---

## 6. Explicitly Out of Scope for v1

- **Separate Project Manager module or duplicate Project Task database tables**
- **Multi-user sharing, real-time collaboration, or project permissions**
- Custom Kanban board columns (fixed to `To Do`, `In Progress`, `Done`)
- Mobile native apps (iOS / Android)
- Code signing / notarization binaries
- Direct cloud-only database setup (keeping local-first speed)