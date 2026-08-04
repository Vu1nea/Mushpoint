import { describe, expect, it } from 'vitest';
import { buildUpcomingFeed, todaysTasks, topStreaks } from './dashboard';
import type { GoalSummary, StreakCard, Subgoal, TaskSummary } from './api/types';

const baseTask: TaskSummary = {
  id: 1,
  title: 'Task',
  status: 'todo',
  dueDate: null,
  goalId: null,
  subgoalId: null,
  recurrence: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  completedToday: false,
  expectedToday: true
};

const baseGoal: GoalSummary = {
  id: 1,
  categoryId: null,
  title: 'Goal',
  description: null,
  timeframe: 'short',
  status: 'active',
  dueDate: null,
  motivationText: null,
  motivationImagePath: null,
  repoUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  progress: 0,
  subgoalCount: 0,
  taskCount: 0,
  fromIdea: false
};

const baseSubgoal: Subgoal = {
  id: 1,
  goalId: 1,
  title: 'Subgoal',
  dueDate: null,
  isComplete: false,
  position: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const NOW = new Date(2026, 7, 3); // Aug 3, 2026 — local, matches daysUntil's local-day math

describe('todaysTasks', () => {
  it('includes a recurring task only when expectedToday is true', () => {
    const habitDue = { ...baseTask, id: 1, recurrence: 'daily' as const, expectedToday: true };
    const habitNotDue = { ...baseTask, id: 2, recurrence: 'daily' as const, expectedToday: false };
    expect(todaysTasks([habitDue, habitNotDue], NOW)).toEqual([habitDue]);
  });

  it('includes a non-recurring task only when dueDate is exactly today, not overdue or future', () => {
    const dueToday = { ...baseTask, id: 1, dueDate: '2026-08-03' };
    const overdue = { ...baseTask, id: 2, dueDate: '2026-08-01' };
    const future = { ...baseTask, id: 3, dueDate: '2026-08-10' };
    const undated = { ...baseTask, id: 4, dueDate: null };
    expect(todaysTasks([dueToday, overdue, future, undated], NOW)).toEqual([dueToday]);
  });

  it('ignores expectedToday=true on a non-recurring task when its due date is not today', () => {
    // expectedToday is always true for non-recurring tasks (see TaskSummary doc comment) —
    // this is the trap the filter must not fall into.
    const wronglyTemptingTask = { ...baseTask, id: 1, dueDate: '2026-08-10', expectedToday: true };
    expect(todaysTasks([wronglyTemptingTask], NOW)).toEqual([]);
  });
});

describe('buildUpcomingFeed', () => {
  it('merges goals, subgoals and tasks with non-null due dates, sorted soonest/most-overdue first', () => {
    const goal = { ...baseGoal, id: 1, title: 'Goal A', dueDate: '2026-08-10' };
    const subgoal = { ...baseSubgoal, id: 1, goalId: 1, title: 'Subgoal A', dueDate: '2026-08-01' };
    const task = { ...baseTask, id: 1, goalId: 1, title: 'Task A', dueDate: '2026-08-05' };
    const feed = buildUpcomingFeed([goal], [subgoal], [task], NOW);
    expect(feed.map((item) => item.title)).toEqual(['Subgoal A', 'Task A', 'Goal A']);
  });

  it('excludes goals, subgoals and tasks with a null due date', () => {
    const goal = { ...baseGoal, id: 1, dueDate: null };
    const subgoal = { ...baseSubgoal, id: 1, goalId: 1, dueDate: null };
    const task = { ...baseTask, id: 1, dueDate: null };
    expect(buildUpcomingFeed([goal], [subgoal], [task], NOW)).toEqual([]);
  });

  it('excludes a completed task and a completed subgoal even with a due date', () => {
    const doneTask = { ...baseTask, id: 1, dueDate: '2026-08-05', status: 'done' as const };
    const doneSubgoal = { ...baseSubgoal, id: 1, goalId: 1, dueDate: '2026-08-05', isComplete: true };
    const goal = { ...baseGoal, id: 1, dueDate: '2026-08-10' };
    const feed = buildUpcomingFeed([goal], [doneSubgoal], [doneTask], NOW);
    expect(feed.map((item) => item.kind)).toEqual(['goal']);
  });

  it('excludes a subgoal whose parent goal is not in the passed-in (active) goals list', () => {
    const orphanSubgoal = { ...baseSubgoal, id: 1, goalId: 99, dueDate: '2026-08-05' };
    expect(buildUpcomingFeed([], [orphanSubgoal], [], NOW)).toEqual([]);
  });

  it('sets href to null for a standalone task with no goalId, and fills parentLabel for a subgoal', () => {
    const goal = { ...baseGoal, id: 1, title: 'Parent Goal', dueDate: null };
    const subgoal = { ...baseSubgoal, id: 1, goalId: 1, dueDate: '2026-08-05' };
    const standaloneTask = { ...baseTask, id: 1, goalId: null, dueDate: '2026-08-05' };
    const feed = buildUpcomingFeed([goal], [subgoal], [standaloneTask], NOW);
    const subgoalItem = feed.find((item) => item.kind === 'subgoal');
    const taskItem = feed.find((item) => item.kind === 'task');
    expect(subgoalItem?.parentLabel).toBe('Parent Goal');
    expect(subgoalItem?.href).toBe('/goals/1');
    expect(taskItem?.href).toBeNull();
  });
});

describe('topStreaks', () => {
  const cardWith = (current: number, longest: number, id: number): StreakCard => ({
    task: { ...baseTask, id },
    current,
    longest,
    doneToday: false,
    cells: []
  });

  it('returns the top N streaks sorted by current streak descending', () => {
    const cards = [cardWith(2, 5, 1), cardWith(9, 9, 2), cardWith(5, 5, 3)];
    expect(topStreaks(cards, 2).map((c) => c.task.id)).toEqual([2, 3]);
  });

  it('breaks ties by longest streak', () => {
    const cards = [cardWith(3, 4, 1), cardWith(3, 9, 2)];
    expect(topStreaks(cards, 2).map((c) => c.task.id)).toEqual([2, 1]);
  });

  it('defaults to a limit of 3', () => {
    const cards = [cardWith(1, 1, 1), cardWith(2, 2, 2), cardWith(3, 3, 3), cardWith(4, 4, 4)];
    expect(topStreaks(cards)).toHaveLength(3);
  });
});
