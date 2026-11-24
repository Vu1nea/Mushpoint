/** Dashboard-only aggregation logic. Pure, so `now` is always passed in rather than read. */

import type { Goal, GoalSummary, StreakCard, Subgoal, TaskSummary } from './api/types';
import { parseDate } from 'mushpoint-design/utils/format';
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

/** Open, non-recurring tasks whose due date has already passed. Habits are
 * excluded: they repeat, so a missed day is a streak matter, not an overdue one. */
export function overdueTasks(tasks: TaskSummary[], now: Date = new Date()): TaskSummary[] {
	return tasks.filter(
		(task) => !task.recurrence && task.status !== 'done' && (daysUntil(task.dueDate, now) ?? 0) < 0
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
		.filter(
			(subgoal) => !subgoal.isComplete && subgoal.dueDate !== null && goalById.has(subgoal.goalId)
		)
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
	return [...streaks]
		.sort((a, b) => b.current - a.current || b.longest - a.longest)
		.slice(0, limit);
}

export interface DashboardStats {
	activeGoals: number;
	dueToday: number;
	overdue: number;
	bestStreak: number;
}

/** The numbers for the dashboard's stat strip. */
export function dashboardStats(
	goals: Goal[],
	tasks: TaskSummary[],
	streaks: StreakCard[],
	now: Date = new Date()
): DashboardStats {
	return {
		activeGoals: goals.filter((goal) => goal.status === 'active').length,
		dueToday: todaysTasks(tasks, now).length,
		overdue: overdueTasks(tasks, now).length,
		bestStreak: streaks.reduce((best, card) => Math.max(best, card.current), 0)
	};
}

/** `YYYY-MM-DD` in local time, the key calendar cells and due dates are matched on. */
export function dayKey(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

/** Items grouped by the local calendar day they are due. */
export function itemsByDueDay<T extends { dueDate: string | null }>(items: T[]): Map<string, T[]> {
	const byDay = new Map<string, T[]>();
	for (const item of items) {
		const due = parseDate(item.dueDate);
		if (!due) continue;
		const key = dayKey(due);
		byDay.set(key, [...(byDay.get(key) ?? []), item]);
	}
	return byDay;
}

/** The cells of one month, Monday first: leading `null`s pad the first week. */
export function monthCells(year: number, month: number): (Date | null)[] {
	const lead = (new Date(year, month, 1).getDay() + 6) % 7;
	const length = new Date(year, month + 1, 0).getDate();
	return [
		...Array.from({ length: lead }, () => null),
		...Array.from({ length }, (_, index) => new Date(year, month, index + 1))
	];
}

export interface OnTimeDay {
	/** Local `YYYY-MM-DD`. */
	date: string;
	/** Tasks due that day. */
	due: number;
	/** Of those, how many were finished by the end of their due day. */
	onTime: number;
	/** `onTime / due` as 0-100, or `null` when nothing was due. */
	rate: number | null;
}

/** Share of one-off tasks finished by their due day, for each of the last `days` days.
 * Tasks carry no completion timestamp, so a done task counts as finishing on the day
 * it was last updated. Habits are left out: their streaks already track each day. */
export function onTimeByDay(tasks: TaskSummary[], days = 14, now: Date = new Date()): OnTimeDay[] {
	const dueByDay = itemsByDueDay(tasks.filter((task) => !task.recurrence));
	return Array.from({ length: days }, (_, index) => {
		const date = dayKey(
			new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - index))
		);
		const due = dueByDay.get(date) ?? [];
		const onTime = due.filter((task) => {
			if (task.status !== 'done') return false;
			const finished = parseDate(task.updatedAt);
			return finished !== null && dayKey(finished) <= date;
		}).length;
		return {
			date,
			due: due.length,
			onTime,
			rate: due.length ? Math.round((onTime / due.length) * 100) : null
		};
	});
}
