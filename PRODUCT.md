# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Tauri + SvelteKit + Tailwind + SQLite (decided in `plans/goal_tracker_plan.md` §1). Tauri wraps the SvelteKit web UI in the OS's native webview (WebView2 / WKWebView) rather than bundling Chromium — a native wrapper around a web build, so the design language stays web, not native. The current interactive mockup (`Mushtrack Static Design/Goal Tracker.dc.html`) is a React/dc-runtime prototype used only to validate layout and information hierarchy; `plans/ui-plan.md` specifies the production UI shell gets built directly in SvelteKit with no port step.

## Users

Single user: the developer, tracking their own goals, habits, projects, ideas, and vision across personal life categories (Work, Gym, School, Side Projects, Social). Personal use only — not building this to publish or hand to other users. No multi-user, no accounts, no roles.

## Product Purpose

A desktop app for creating goals, breaking them into actionable subgoals/tasks, and quantifying progress toward meeting them, so the user can see at a glance whether they're actually moving on what they said mattered. Success means fewer things falling through the cracks across school, gym, work, side projects, and social life, tracked in one place instead of scattered across separate apps.

## Positioning

Unifies five already-proven productivity methodologies — SMART goals, OKRs (Goal = Objective, Subgoal = Key Result), habit tracking (streaks), kanban (Project Manager), and bullet journaling (Idea Vault) — into one local-first tool, instead of running five separate single-purpose apps to cover the same ground.

## Operating Context

- Local-first desktop app, single local SQLite file, no cloud sync, no accounts.
- Default categories: Work, Gym, School, Side Projects, Social, plus user-created custom categories.
- Goals have a timeframe (short/mid/long) and an optional due date; Subgoals and Project Targets are flat (no nesting).
- Recurring tasks track a Streak (current/longest count), with a 2-day global grace period.
- Weekly auto-export to JSON, single most-recent snapshot retained (no history).
- Two pre-built themes — Nocturne (dark, default) and Coquette (light) — switchable in Settings; theme affects color palette now, and is planned to also swap icon sets in a later phase.
- Distributed as unsigned Windows + macOS installers via GitHub Actions; users see an "unidentified developer" warning on first launch.

## Capabilities and Constraints

- Windows + macOS only for v1 — no Linux, no mobile, explicitly out of scope.
- No code signing/notarization in v1 (accepted tradeoff, not a gap to fix).
- No multi-device sync, no cloud hosting, no user accounts/auth in v1.
- AI integration (Claude-generated subgoals, idea categorization, weekly digest) is deferred to a later phase — not in scope for the current build.
- Data model: `Category → Goal → Subgoal → Task` and `Project → Target → Project Task`. Task (Task Manager, linked to Goal/Subgoal, carries recurring/streak) and Project Task (Project board, linked to Project/Target) are **intentionally separate tables**, not a shared entity — each surface owns its own task list by design (confirmed decision, see `plans/goal_tracker_plan.md` §3 design notes).
- Goal carries an explicit `status` (active/completed/archived), independent of its progress % — progress can regress after hitting 100%, so completion is a deliberate user action, not an automatic threshold.
- Progress % (Goals and Projects) is auto-calculated: the average completion across all direct children (subgoals/targets and directly-linked tasks count equally); a subgoal/target's own completion is the average of its own tasks. This keeps progress bars moving continuously instead of jumping in large steps.
- Project kanban board uses fixed columns (To Do / In Progress / Done) — custom columns explicitly not wanted for v1.

## Brand Commitments

- Product name: **Mushpoint** (per the mockup's sidebar wordmark and logo badge — the "Mush-Track" repo/folder name is just the working project folder, not the product name).
- Tagline used in the mockup header: "Personal operating system."
- Logo mark: a single letter "M" in a filled circular badge, accent-colored per active theme.

## Evidence on Hand

- Interactive static mockup at `Mushtrack Static Design/Goal Tracker.dc.html` (React/dc-runtime, sample/fixture data only, no persistence) covering all seven screens: Dashboard, Goal Tracker, Project Manager, Task Manager, Idea Vault, Vision Board, Settings — in both themes.
- Full project/feature plan at `plans/goal_tracker_plan.md` (tech stack, data model, feature breakdown, build order, explicit out-of-scope list).
- Supplementary UI shell notes at `plans/ui-plan.md` (screen-by-screen layout intent, motion/animation spec, theme token tables, planned SvelteKit technical approach).
- Open build punch-list in `plans/mockup-next-steps.md` and `TODO.md` (e.g. progress bars need rounded ends; error states, API, and Playwright tests still to be planned/implemented).
- No real user content, testimonials, or production data exists yet — all current goals/tasks/ideas in the mockup are fixture/sample data and must not be treated as real evidence.

## Product Principles

1. Local-first, single-user, always — no cloud, no accounts; simplicity over any collaboration feature.
2. Borrow proven methodologies instead of inventing new ones — SMART, OKR, habit tracking, kanban, and bullet journaling map directly onto the data model rather than a bespoke system.
3. Progress should feel continuous — the averaging rule exists specifically so progress bars move smoothly instead of jumping in big steps.
4. Capture stays low-friction — the Idea Vault and dashboard Quick Add exist so nothing has to leave a fast, minimal-friction inbox just to get recorded.
5. Shared structure, deliberately separate task lists — Subgoal/Target share one flat-grouping concept across Goals and Projects, but Task Manager tasks and Project-board tasks stay separate tables so each surface's list only shows what belongs to it.
