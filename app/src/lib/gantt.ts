import type { GoalDetail } from './api';
import { compareDates } from './db/logic/dates';
import { localDateOf } from './db/repo/helpers';

export interface GanttRow {
	key: string;
	title: string;
	kind: 'subgoal' | 'task';
	start: string;
	end: string;
	done: boolean;
	overdue: boolean;
	/** Bar position as a percentage of the chart's width. */
	left: number;
	width: number;
}

export interface GanttChart {
	start: string;
	end: string;
	todayLeft: number;
	rows: GanttRow[];
	/** Subgoals and tasks with no due date, so no bar to draw. */
	undated: number;
}

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
const earliest = (dates: string[]) => dates.reduce((a, b) => (compareDates(a, b) <= 0 ? a : b));
const latest = (dates: string[]) => dates.reduce((a, b) => (compareDates(a, b) >= 0 ? a : b));

/**
 * Lays a goal's subgoals and direct tasks out on one timeline. Nothing stores a
 * start date, so each bar runs from creation to due date. Habits are left out:
 * they repeat, so there is no end to draw.
 */
export function ganttChart(
	goal: Pick<GoalDetail, 'subgoals' | 'directTasks' | 'dueDate'>,
	today: string
): GanttChart {
	const items = [
		...goal.subgoals.map((subgoal) => ({
			key: `subgoal-${subgoal.id}`,
			kind: 'subgoal' as const,
			title: subgoal.title,
			createdAt: subgoal.createdAt,
			dueDate: subgoal.dueDate,
			done: subgoal.isComplete || subgoal.progress >= 1
		})),
		...goal.directTasks
			.filter((task) => task.recurrence === null)
			.map((task) => ({
				key: `task-${task.id}`,
				kind: 'task' as const,
				title: task.title,
				createdAt: task.createdAt,
				dueDate: task.dueDate,
				done: task.status === 'done'
			}))
	];

	const dated = items.flatMap(({ dueDate, createdAt, ...item }) => {
		if (!dueDate) return [];
		return [{ ...item, start: earliest([localDateOf(createdAt), dueDate]), end: dueDate }];
	});

	const start = earliest([today, ...dated.map((item) => item.start)]);
	const end = latest([
		today,
		...dated.map((item) => item.end),
		...(goal.dueDate ? [goal.dueDate] : [])
	]);
	const span = dayNumber(end) - dayNumber(start) + 1;
	const leftOf = (date: string) => ((dayNumber(date) - dayNumber(start)) / span) * 100;

	return {
		start,
		end,
		todayLeft: leftOf(today),
		undated: items.length - dated.length,
		rows: dated.map((item) => ({
			...item,
			overdue: !item.done && compareDates(item.end, today) < 0,
			left: leftOf(item.start),
			width: ((dayNumber(item.end) - dayNumber(item.start) + 1) / span) * 100
		}))
	};
}
