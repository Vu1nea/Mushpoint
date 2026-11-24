import { describe, expect, it } from 'vitest';
import {
	buildUpcomingFeed,
	dashboardStats,
	dayKey,
	itemsByDueDay,
	monthCells,
	onTimeByDay,
	overdueTasks,
	todaysTasks,
	topStreaks
} from './dashboard';
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
		const doneSubgoal = {
			...baseSubgoal,
			id: 1,
			goalId: 1,
			dueDate: '2026-08-05',
			isComplete: true
		};
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

describe('dashboardStats', () => {
	const card = (current: number, id: number): StreakCard => ({
		task: { ...baseTask, id },
		current,
		longest: current,
		doneToday: false,
		cells: []
	});

	it('returns zeros for no data', () => {
		expect(dashboardStats([], [], [], NOW)).toEqual({
			activeGoals: 0,
			dueToday: 0,
			overdue: 0,
			bestStreak: 0
		});
	});

	it('counts only active goals', () => {
		const goals = [
			{ ...baseGoal, id: 1 },
			{ ...baseGoal, id: 2, status: 'completed' as const },
			{ ...baseGoal, id: 3, status: 'archived' as const }
		];
		expect(dashboardStats(goals, [], [], NOW).activeGoals).toBe(1);
	});

	it('dueToday matches todaysTasks', () => {
		const tasks = [
			{ ...baseTask, id: 1, dueDate: '2026-08-03' },
			{ ...baseTask, id: 2, dueDate: '2026-08-10' }
		];
		expect(dashboardStats([], tasks, [], NOW).dueToday).toBe(todaysTasks(tasks, NOW).length);
		expect(dashboardStats([], tasks, [], NOW).dueToday).toBe(1);
	});

	it('bestStreak is the highest current streak', () => {
		expect(dashboardStats([], [], [card(2, 1), card(7, 2), card(4, 3)], NOW).bestStreak).toBe(7);
	});
});

describe('overdueTasks', () => {
	const now = new Date(2026, 5, 10, 12);

	it('keeps open one-off tasks due before today', () => {
		const late = { ...baseTask, id: 2, dueDate: '2026-06-09' };
		expect(overdueTasks([late], now)).toEqual([late]);
	});

	it('ignores tasks due today, later, or with no due date', () => {
		const tasks = [
			{ ...baseTask, id: 2, dueDate: '2026-06-10' },
			{ ...baseTask, id: 3, dueDate: '2026-06-11' },
			{ ...baseTask, id: 4, dueDate: null }
		];
		expect(overdueTasks(tasks, now)).toEqual([]);
	});

	it('ignores finished tasks and habits', () => {
		const tasks = [
			{ ...baseTask, id: 2, dueDate: '2026-06-01', status: 'done' as const },
			{ ...baseTask, id: 3, dueDate: '2026-06-01', recurrence: 'daily' as const }
		];
		expect(overdueTasks(tasks, now)).toEqual([]);
	});
});

describe('calendar helpers', () => {
	it('dayKey is the local YYYY-MM-DD', () => {
		expect(dayKey(new Date(2026, 10, 5))).toBe('2026-11-05');
	});

	it('monthCells pads to a Monday start and lists every day', () => {
		// 1 Nov 2026 is a Sunday: six empty cells before it.
		const cells = monthCells(2026, 10);
		expect(cells.slice(0, 6).every((cell) => cell === null)).toBe(true);
		expect(cells[6]?.getDate()).toBe(1);
		expect(cells.filter(Boolean)).toHaveLength(30);
	});

	it('itemsByDueDay groups by day and skips undated items', () => {
		const goals = [
			{ id: 1, dueDate: '2026-11-05' },
			{ id: 2, dueDate: '2026-11-05' },
			{ id: 3, dueDate: null }
		] as { id: number; dueDate: string | null }[];
		const byDay = itemsByDueDay(goals);
		expect(byDay.get('2026-11-05')?.map((item) => item.id)).toEqual([1, 2]);
		expect(byDay.size).toBe(1);
	});
});

describe('onTimeByDay', () => {
	const now = new Date(2026, 10, 10, 12);
	const task = (id: number, dueDate: string | null, status: string, updatedAt: string) =>
		({ id, dueDate, status, updatedAt, recurrence: null }) as unknown as TaskSummary;

	it('covers the last N days, oldest first, with null where nothing was due', () => {
		const days = onTimeByDay([], 3, now);
		expect(days.map((day) => day.date)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10']);
		expect(days.every((day) => day.rate === null)).toBe(true);
	});

	it('counts a done task finished on or before its due day', () => {
		const days = onTimeByDay(
			[
				task(1, '2026-11-09', 'done', new Date(2026, 10, 9, 8).toISOString()),
				task(2, '2026-11-09', 'done', new Date(2026, 10, 10, 8).toISOString()),
				task(3, '2026-11-09', 'todo', new Date(2026, 10, 1).toISOString())
			],
			2,
			now
		);
		expect(days[0]).toMatchObject({ due: 3, onTime: 1, rate: 33 });
	});

	it('skips habits', () => {
		const habit = { ...task(1, '2026-11-10', 'done', now.toISOString()), recurrence: 'daily' };
		expect(onTimeByDay([habit as TaskSummary], 1, now)[0].due).toBe(0);
	});
});
