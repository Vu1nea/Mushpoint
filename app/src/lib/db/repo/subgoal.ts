import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { Subgoal, SubgoalDetail, SubgoalInput, SubgoalUpdate } from '../../api/types';
import { now, optionalText, requiredText } from './helpers';
import * as task from './task';
import { countsTowardProgress, subgoalProgress, taskCompletion } from '../logic/progress';

const COLUMNS = 'id, goal_id, title, due_date, is_complete, position, created_at, updated_at';
const ORDER = 'ORDER BY position, id';

interface SubgoalRow {
	id: number;
	goal_id: number;
	title: string;
	due_date: string | null;
	is_complete: number;
	position: number;
	created_at: string;
	updated_at: string;
}

function map(row: SubgoalRow): Subgoal {
	return {
		id: row.id,
		goalId: row.goal_id,
		title: row.title,
		dueDate: row.due_date,
		isComplete: Boolean(row.is_complete),
		position: row.position,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

/** Every subgoal in the database, grouped by goal. The Task Manager needs this
 * to offer subgoals as task parents without loading one goal at a time. */
export async function listAll(driver: SqlDriver): Promise<Subgoal[]> {
	const rows = await driver.select<SubgoalRow>(
		`SELECT ${COLUMNS} FROM subgoals ORDER BY goal_id, position, id`
	);
	return rows.map(map);
}

export async function listForGoal(driver: SqlDriver, goalId: number): Promise<Subgoal[]> {
	const rows = await driver.select<SubgoalRow>(
		`SELECT ${COLUMNS} FROM subgoals WHERE goal_id = ?1 ${ORDER}`,
		[goalId]
	);
	return rows.map(map);
}

/** Each subgoal with its tasks and its own progress attached. */
export async function detailForGoal(driver: SqlDriver, goalId: number): Promise<SubgoalDetail[]> {
	const subgoals = await listForGoal(driver, goalId);
	const details: SubgoalDetail[] = [];
	for (const subgoal of subgoals) {
		const tasks = await task.listForSubgoal(driver, subgoal.id);
		const completions = tasks.filter(countsTowardProgress).map((t) => taskCompletion(t.status));
		details.push({ ...subgoal, progress: subgoalProgress(subgoal.isComplete, completions), tasks });
	}
	return details;
}

/** Just the progress numbers, for computing a parent goal's average. */
export async function progressesForGoal(driver: SqlDriver, goalId: number): Promise<number[]> {
	return (await detailForGoal(driver, goalId)).map((detail) => detail.progress);
}

export async function get(driver: SqlDriver, id: number): Promise<Subgoal> {
	const rows = await driver.select<SubgoalRow>(`SELECT ${COLUMNS} FROM subgoals WHERE id = ?1`, [
		id
	]);
	const row = rows[0];
	if (!row) throw AppError.notFound('subgoal', id);
	return map(row);
}

export async function create(driver: SqlDriver, input: SubgoalInput): Promise<Subgoal> {
	const title = requiredText('subgoal title', input.title);
	const owner = await driver.select('SELECT id FROM goals WHERE id = ?1', [input.goalId]);
	if (owner.length === 0) throw AppError.notFound('goal', input.goalId);

	const nextPosition = await driver.select<{ next: number }>(
		'SELECT COALESCE(MAX(position) + 1, 0) as next FROM subgoals WHERE goal_id = ?1',
		[input.goalId]
	);
	const timestamp = now();

	const result = await driver.execute(
		`INSERT INTO subgoals (goal_id, title, due_date, is_complete, position, created_at, updated_at)
         VALUES (?1, ?2, ?3, 0, ?4, ?5, ?5)`,
		[input.goalId, title, optionalText(input.dueDate), nextPosition[0].next, timestamp]
	);

	return get(driver, result.lastInsertId);
}

export async function update(
	driver: SqlDriver,
	id: number,
	input: SubgoalUpdate
): Promise<Subgoal> {
	const title = requiredText('subgoal title', input.title);
	const result = await driver.execute(
		`UPDATE subgoals SET title = ?1, due_date = ?2, is_complete = ?3, updated_at = ?4
         WHERE id = ?5`,
		[title, optionalText(input.dueDate), Number(input.isComplete), now(), id]
	);
	if (result.rowsAffected === 0) throw AppError.notFound('subgoal', id);
	return get(driver, id);
}

export async function setComplete(
	driver: SqlDriver,
	id: number,
	isComplete: boolean
): Promise<Subgoal> {
	const result = await driver.execute(
		'UPDATE subgoals SET is_complete = ?1, updated_at = ?2 WHERE id = ?3',
		[Number(isComplete), now(), id]
	);
	if (result.rowsAffected === 0) throw AppError.notFound('subgoal', id);
	return get(driver, id);
}

/** Deleting a subgoal keeps its tasks; they fall back to being direct tasks of
 * the goal (ON DELETE SET NULL on subgoal_id). */
export async function remove(driver: SqlDriver, id: number): Promise<void> {
	const result = await driver.execute('DELETE FROM subgoals WHERE id = ?1', [id]);
	if (result.rowsAffected === 0) throw AppError.notFound('subgoal', id);
}
