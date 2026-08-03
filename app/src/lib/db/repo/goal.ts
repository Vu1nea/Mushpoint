import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { Goal, GoalDetail, GoalInput, GoalStatus, GoalSummary } from '../../api/types';
import { now, optionalText, requiredText } from './helpers';
import * as category from './category';
import * as subgoal from './subgoal';
import * as task from './task';
import { countsTowardProgress, goalProgress, taskCompletion } from '../logic/progress';

const COLUMNS = `id, category_id, title, description, timeframe, status, due_date,
     motivation_text, motivation_image_path, repo_url, created_at, updated_at`;
const ORDER = 'ORDER BY (due_date IS NULL), due_date, created_at DESC, id DESC';

interface GoalRow {
	id: number;
	category_id: number | null;
	title: string;
	description: string | null;
	timeframe: Goal['timeframe'];
	status: GoalStatus;
	due_date: string | null;
	motivation_text: string | null;
	motivation_image_path: string | null;
	repo_url: string | null;
	created_at: string;
	updated_at: string;
}

function map(row: GoalRow): Goal {
	return {
		id: row.id,
		categoryId: row.category_id,
		title: row.title,
		description: row.description,
		timeframe: row.timeframe,
		status: row.status,
		dueDate: row.due_date,
		motivationText: row.motivation_text,
		motivationImagePath: row.motivation_image_path,
		repoUrl: row.repo_url,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

/** Which of these goal ids were promoted from an idea. One query keyed by
 * the goal id set, same shape as how `list`/`getDetail` already do per-row
 * lookups for subgoal/task counts — avoids an extra query per goal. */
async function fromIdeaIds(driver: SqlDriver, goalIds: number[]): Promise<Set<number>> {
	if (goalIds.length === 0) return new Set();
	const placeholders = goalIds.map((_, i) => `?${i + 1}`).join(', ');
	const rows = await driver.select<{ promoted_goal_id: number }>(
		`SELECT promoted_goal_id FROM ideas WHERE promoted_goal_id IN (${placeholders})`,
		goalIds
	);
	return new Set(rows.map((r) => r.promoted_goal_id));
}

/** Lists goals, optionally narrowed to one status — the Goals page shows active
 * ones by default and completed/archived behind a filter. */
export async function list(driver: SqlDriver, status: GoalStatus | null): Promise<GoalSummary[]> {
	const filter = status !== null ? 'WHERE status = ?1' : '';
	const rows = await driver.select<GoalRow>(
		`SELECT ${COLUMNS} FROM goals ${filter} ${ORDER}`,
		status !== null ? [status] : []
	);
	const mapped = rows.map(map);
	const fromIdea = await fromIdeaIds(driver, mapped.map((row) => row.id));

	const summaries: GoalSummary[] = [];
	for (const row of mapped) {
		const subgoalProgresses = await subgoal.progressesForGoal(driver, row.id);
		const directTasks = await task.listDirectForGoal(driver, row.id);
		const completions = directTasks.filter(countsTowardProgress).map((t) => taskCompletion(t.status));

		summaries.push({
			...row,
			progress: goalProgress(subgoalProgresses, completions),
			subgoalCount: subgoalProgresses.length,
			taskCount: directTasks.length,
			fromIdea: fromIdea.has(row.id)
		});
	}
	return summaries;
}

/** The goal plus its subgoals, tasks and derived progress, in one round trip. */
export async function getDetail(driver: SqlDriver, id: number): Promise<GoalDetail> {
	const goal = await get(driver, id);
	const subgoals = await subgoal.detailForGoal(driver, id);
	const directTasks = await task.listDirectForGoal(driver, id);

	const subgoalProgresses = subgoals.map((s) => s.progress);
	const completions = directTasks.filter(countsTowardProgress).map((t) => taskCompletion(t.status));
	const category_ = goal.categoryId !== null ? await category.get(driver, goal.categoryId) : null;
	const fromIdea = (await fromIdeaIds(driver, [id])).has(id);

	return {
		...goal,
		progress: goalProgress(subgoalProgresses, completions),
		category: category_,
		subgoals,
		directTasks,
		fromIdea
	};
}

export async function get(driver: SqlDriver, id: number): Promise<Goal> {
	const rows = await driver.select<GoalRow>(`SELECT ${COLUMNS} FROM goals WHERE id = ?1`, [id]);
	const row = rows[0];
	if (!row) throw AppError.notFound('goal', id);
	return map(row);
}

export async function ensureExists(driver: SqlDriver, id: number): Promise<void> {
	const rows = await driver.select('SELECT id FROM goals WHERE id = ?1', [id]);
	if (rows.length === 0) throw AppError.notFound('goal', id);
}

export async function create(driver: SqlDriver, input: GoalInput): Promise<Goal> {
	const title = requiredText('goal title', input.title);
	if (input.categoryId !== null) {
		await category.get(driver, input.categoryId);
	}
	const timestamp = now();

	const result = await driver.execute(
		`INSERT INTO goals (category_id, title, description, timeframe, status, due_date,
                            motivation_text, motivation_image_path, repo_url, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, ?7, ?8, ?9, ?9)`,
		[
			input.categoryId,
			title,
			optionalText(input.description),
			input.timeframe,
			optionalText(input.dueDate),
			optionalText(input.motivationText),
			optionalText(input.motivationImagePath),
			optionalText(input.repoUrl),
			timestamp
		]
	);

	return get(driver, result.lastInsertId);
}

export async function update(driver: SqlDriver, id: number, input: GoalInput): Promise<Goal> {
	const title = requiredText('goal title', input.title);
	if (input.categoryId !== null) {
		await category.get(driver, input.categoryId);
	}

	const result = await driver.execute(
		`UPDATE goals
         SET category_id = ?1, title = ?2, description = ?3, timeframe = ?4, due_date = ?5,
             motivation_text = ?6, motivation_image_path = ?7, repo_url = ?8, updated_at = ?9
         WHERE id = ?10`,
		[
			input.categoryId,
			title,
			optionalText(input.description),
			input.timeframe,
			optionalText(input.dueDate),
			optionalText(input.motivationText),
			optionalText(input.motivationImagePath),
			optionalText(input.repoUrl),
			now(),
			id
		]
	);

	if (result.rowsAffected === 0) throw AppError.notFound('goal', id);
	return get(driver, id);
}

/** Completing or archiving is always an explicit user action — progress hitting
 * 100% never flips this by itself. */
export async function setStatus(driver: SqlDriver, id: number, status: GoalStatus): Promise<Goal> {
	const result = await driver.execute('UPDATE goals SET status = ?1, updated_at = ?2 WHERE id = ?3', [
		status,
		now(),
		id
	]);
	if (result.rowsAffected === 0) throw AppError.notFound('goal', id);
	return get(driver, id);
}

/** Subgoals cascade-delete with the goal; their tasks only lose their link
 * (ON DELETE SET NULL) and would otherwise survive as standalone tasks. The
 * caller decides whether that's what the user wants. */
export async function remove(
	driver: SqlDriver,
	id: number,
	deleteOrphanedTasks: boolean
): Promise<void> {
	if (deleteOrphanedTasks) {
		await driver.execute(
			'DELETE FROM tasks WHERE subgoal_id IN (SELECT id FROM subgoals WHERE goal_id = ?1)',
			[id]
		);
	}

	const result = await driver.execute('DELETE FROM goals WHERE id = ?1', [id]);
	if (result.rowsAffected === 0) throw AppError.notFound('goal', id);
}
