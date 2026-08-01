import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { Task, TaskInput, TaskStatus, TaskSummary, TaskUpdate } from '../../api/types';
import { now, optionalText, requiredText, today } from './helpers';

const COLUMNS =
	'id, title, status, due_date, goal_id, subgoal_id, recurrence, created_at, updated_at';
const ORDER = 'ORDER BY (due_date IS NULL), due_date, id';
const SUMMARY_COLUMNS = `t.id, t.title, t.status, t.due_date, t.goal_id, t.subgoal_id,
     t.recurrence, t.created_at, t.updated_at`;

interface TaskRow {
	id: number;
	title: string;
	status: TaskStatus;
	due_date: string | null;
	goal_id: number | null;
	subgoal_id: number | null;
	recurrence: Task['recurrence'];
	created_at: string;
	updated_at: string;
}

function map(row: TaskRow): Task {
	return {
		id: row.id,
		title: row.title,
		status: row.status,
		dueDate: row.due_date,
		goalId: row.goal_id,
		subgoalId: row.subgoal_id,
		recurrence: row.recurrence,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export function isRecurring(task: Task): boolean {
	return task.recurrence !== null;
}

/** The board's list. One join rather than a completion query per row. */
export async function list(driver: SqlDriver): Promise<TaskSummary[]> {
	const rows = await driver.select<TaskRow & { completed_today: number }>(
		`SELECT ${SUMMARY_COLUMNS}, c.id IS NOT NULL AS completed_today
         FROM tasks t
         LEFT JOIN task_completions c
             ON c.task_id = t.id AND c.completed_on = ?1
         ORDER BY (t.due_date IS NULL), t.due_date, t.id`,
		[today()]
	);
	return rows.map((row) => ({ ...map(row), completedToday: Boolean(row.completed_today) }));
}

/** Every habit, for the streak cards. */
export async function listRecurring(driver: SqlDriver): Promise<Task[]> {
	const rows = await driver.select<TaskRow>(
		`SELECT ${COLUMNS} FROM tasks WHERE recurrence IS NOT NULL ${ORDER}`
	);
	return rows.map(map);
}

export async function listForSubgoal(driver: SqlDriver, subgoalId: number): Promise<Task[]> {
	const rows = await driver.select<TaskRow>(
		`SELECT ${COLUMNS} FROM tasks WHERE subgoal_id = ?1 ${ORDER}`,
		[subgoalId]
	);
	return rows.map(map);
}

/** Tasks hanging straight off the goal — the ones that count as its own direct
 * children for progress. Tasks under a subgoal are counted by that subgoal. */
export async function listDirectForGoal(driver: SqlDriver, goalId: number): Promise<Task[]> {
	const rows = await driver.select<TaskRow>(
		`SELECT ${COLUMNS} FROM tasks WHERE goal_id = ?1 AND subgoal_id IS NULL ${ORDER}`,
		[goalId]
	);
	return rows.map(map);
}

export async function get(driver: SqlDriver, id: number): Promise<Task> {
	const rows = await driver.select<TaskRow>(`SELECT ${COLUMNS} FROM tasks WHERE id = ?1`, [id]);
	const row = rows[0];
	if (!row) throw AppError.notFound('task', id);
	return map(row);
}

export async function create(driver: SqlDriver, input: TaskInput): Promise<Task> {
	const title = requiredText('task title', input.title);
	const { goalId, subgoalId } = await resolveParents(driver, input.goalId, input.subgoalId);
	const timestamp = now();

	const result = await driver.execute(
		`INSERT INTO tasks (title, status, due_date, goal_id, subgoal_id, recurrence, created_at, updated_at)
         VALUES (?1, 'todo', ?2, ?3, ?4, ?5, ?6, ?6)`,
		[title, optionalText(input.dueDate), goalId, subgoalId, input.recurrence, timestamp]
	);

	return get(driver, result.lastInsertId);
}

export async function update(driver: SqlDriver, id: number, input: TaskUpdate): Promise<Task> {
	const title = requiredText('task title', input.title);
	const { goalId, subgoalId } = await resolveParents(driver, input.goalId, input.subgoalId);

	const result = await driver.execute(
		`UPDATE tasks
         SET title = ?1, status = ?2, due_date = ?3, goal_id = ?4, subgoal_id = ?5,
             recurrence = ?6, updated_at = ?7
         WHERE id = ?8`,
		[title, input.status, optionalText(input.dueDate), goalId, subgoalId, input.recurrence, now(), id]
	);

	if (result.rowsAffected === 0) throw AppError.notFound('task', id);
	return get(driver, id);
}

export async function setStatus(driver: SqlDriver, id: number, status: TaskStatus): Promise<Task> {
	const result = await driver.execute('UPDATE tasks SET status = ?1, updated_at = ?2 WHERE id = ?3', [
		status,
		now(),
		id
	]);
	if (result.rowsAffected === 0) throw AppError.notFound('task', id);
	return get(driver, id);
}

export async function remove(driver: SqlDriver, id: number): Promise<void> {
	const result = await driver.execute('DELETE FROM tasks WHERE id = ?1', [id]);
	if (result.rowsAffected === 0) throw AppError.notFound('task', id);
}

/** A task under a subgoal always belongs to that subgoal's goal, whatever the
 * caller passed — otherwise progress could count the task under the wrong parent. */
async function resolveParents(
	driver: SqlDriver,
	goalId: number | null,
	subgoalId: number | null
): Promise<{ goalId: number | null; subgoalId: number | null }> {
	if (subgoalId === null) {
		if (goalId !== null) {
			const rows = await driver.select('SELECT id FROM goals WHERE id = ?1', [goalId]);
			if (rows.length === 0) throw AppError.notFound('goal', goalId);
		}
		return { goalId, subgoalId: null };
	}

	const rows = await driver.select<{ goal_id: number }>(
		'SELECT goal_id FROM subgoals WHERE id = ?1',
		[subgoalId]
	);
	if (rows.length === 0) throw AppError.notFound('subgoal', subgoalId);
	return { goalId: rows[0].goal_id, subgoalId };
}
