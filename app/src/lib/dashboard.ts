/** Dashboard-only aggregation logic. Pure, so `now` is always passed in rather than read. */

import type { GoalSummary, StreakCard, Subgoal, TaskSummary } from './api/types';
import { daysUntil } from './format';

/** A recurring task's expectedToday is cadence-aware and correct as-is. A
 * non-recurring task's expectedToday is always true (it has no cadence to be
 * "not expected" against — see the TaskSummary doc comment), so for those the
 * only correct "is this due today" signal is the due date itself. */
export function todaysTasks(tasks: TaskSummary[], now: Date = new Date()): TaskSummary[] {
  return tasks.filter((task) =>
    task.recurrence ? task.expectedToday : daysUntil(task.dueDate, now) === 0
  );
}

export type UpcomingKind = 'goal' | 'subgoal' | 'task';

export interface UpcomingItem {
  kind: UpcomingKind;
  id: number;
  title: string;
  dueDate: string;
  href: string | null;
  parentLabel: string | null;
}

/** Merges due-dated goals, subgoals and tasks into one feed, soonest/most-overdue
 * first. `goals` is expected to already be the active-only set from the loader —
 * this keeps completed/archived goals (and any subgoal under one) out of the feed
 * without a second status filter here. */
export function buildUpcomingFeed(
  goals: GoalSummary[],
  subgoals: Subgoal[],
  tasks: TaskSummary[],
  now: Date = new Date()
): UpcomingItem[] {
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));

  const goalItems: UpcomingItem[] = goals
    .filter((goal) => goal.dueDate !== null)
    .map((goal) => ({
      kind: 'goal',
      id: goal.id,
      title: goal.title,
      dueDate: goal.dueDate as string,
      href: `/goals/${goal.id}`,
      parentLabel: null
    }));

  const subgoalItems: UpcomingItem[] = subgoals
    .filter((subgoal) => !subgoal.isComplete && subgoal.dueDate !== null && goalById.has(subgoal.goalId))
    .map((subgoal) => ({
      kind: 'subgoal',
      id: subgoal.id,
      title: subgoal.title,
      dueDate: subgoal.dueDate as string,
      href: `/goals/${subgoal.goalId}`,
      parentLabel: goalById.get(subgoal.goalId)?.title ?? null
    }));

  const taskItems: UpcomingItem[] = tasks
    .filter((task) => task.status !== 'done' && task.dueDate !== null)
    .map((task) => ({
      kind: 'task',
      id: task.id,
      title: task.title,
      dueDate: task.dueDate as string,
      href: task.goalId ? `/goals/${task.goalId}` : null,
      parentLabel: null
    }));

  return [...goalItems, ...subgoalItems, ...taskItems].sort(
    (a, b) => (daysUntil(a.dueDate, now) ?? 0) - (daysUntil(b.dueDate, now) ?? 0)
  );
}

/** Highest current streak first, ties broken by longest. */
export function topStreaks(streaks: StreakCard[], limit = 3): StreakCard[] {
  return [...streaks].sort((a, b) => b.current - a.current || b.longest - a.longest).slice(0, limit);
}
