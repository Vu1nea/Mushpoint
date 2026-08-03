# Todos

- Plan diff error states, judge overall UX design, and write playwright tests
- Plan api
- Implement and test api
- Make logs (e.g What to do when there's error etc.)
- Done today incorrect streak ui

## Open after Phase 3 (streaks)

Found by the final review of Phase 3. Neither is a data-integrity problem, but both
leave two screens disagreeing about the same habit. See
`docs/superpowers/specs/2026-07-31-streaks-design.md` for the rules they collide with.

- **Goal detail still treats habits as one-off tasks.** `TaskRow.svelte` (used for a
  goal's direct tasks and its subgoal tasks) ticks a habit by writing `status = 'done'`,
  which logs no completion, moves no streak, and moves no progress. The same habit then
  reads Done on `/goals/<id>` and "Do today" on `/tasks`. Fixing it means carrying
  `completedToday` on the tasks inside `GoalDetail`, the way `TaskSummary` already does
  for the board.
- **The board's derived column ignores whether today is an expected occurrence.** A
  Weekly habit shows "Do today" on all seven days, and completing it on a non-expected
  day writes a log row the heatmap greys out and the streak ignores. Needs an
  `expectedToday` flag from the backend, plus a decision about what a habit that isn't
  due today should look like on a kanban board.
- **Minor:** goal pages count habits in the "N direct tasks" copy while excluding them
  from the progress average, so a habit-only goal reads "0% · averaged across 0 subgoals
  and 1 direct tasks".
