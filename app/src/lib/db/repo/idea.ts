import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { Idea, IdeaInput, Tag } from '../../api/types';
import { now, optionalText, requiredText } from './helpers';

const COLUMNS = 'i.id, i.title, i.note, i.promoted_goal_id, i.created_at, i.updated_at';

interface IdeaRow {
	id: number;
	title: string;
	note: string | null;
	promoted_goal_id: number | null;
	created_at: string;
	updated_at: string;
}

interface TagRow {
	id: number;
	name: string;
}

function mapTag(row: TagRow): Tag {
	return { id: row.id, name: row.name };
}

async function tagsForIdea(driver: SqlDriver, ideaId: number): Promise<Tag[]> {
	const rows = await driver.select<TagRow>(
		`SELECT t.id, t.name FROM idea_tags t
         JOIN idea_tag_links l ON l.tag_id = t.id
         WHERE l.idea_id = ?1
         ORDER BY t.name`,
		[ideaId]
	);
	return rows.map(mapTag);
}

async function map(driver: SqlDriver, row: IdeaRow): Promise<Idea> {
	return {
		id: row.id,
		title: row.title,
		note: row.note,
		promotedGoalId: row.promoted_goal_id,
		tags: await tagsForIdea(driver, row.id),
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

/** Get-or-create by case-insensitive name — there is no separate tag
 * management screen, so "CS" and "cs" must resolve to the same row. */
async function resolveTagId(driver: SqlDriver, name: string): Promise<number> {
	const existing = await driver.select<{ id: number }>(
		'SELECT id FROM idea_tags WHERE name = ?1 COLLATE NOCASE',
		[name]
	);
	if (existing.length > 0) return existing[0].id;

	const result = await driver.execute('INSERT INTO idea_tags (name, created_at) VALUES (?1, ?2)', [
		name,
		now()
	]);
	return result.lastInsertId;
}

/** Replaces an idea's tag links wholesale rather than diffing — simpler, and
 * the tag list is short enough that this is never a performance concern. */
async function setTags(driver: SqlDriver, ideaId: number, tagNames: string[]): Promise<void> {
	await driver.execute('DELETE FROM idea_tag_links WHERE idea_id = ?1', [ideaId]);
	for (const raw of tagNames) {
		const name = raw.trim();
		if (!name) continue;
		const tagId = await resolveTagId(driver, name);
		await driver.execute('INSERT OR IGNORE INTO idea_tag_links (idea_id, tag_id) VALUES (?1, ?2)', [
			ideaId,
			tagId
		]);
	}
}

/** The inbox: unpromoted ideas by default, optionally narrowed to one tag.
 * `includePromoted` exists for a future browse view — nothing flips it yet. */
export async function list(
	driver: SqlDriver,
	{ tag, includePromoted = false }: { tag?: string; includePromoted?: boolean } = {}
): Promise<Idea[]> {
	const conditions: string[] = [];
	const params: unknown[] = [];

	if (!includePromoted) conditions.push('i.promoted_goal_id IS NULL');
	if (tag) {
		params.push(tag);
		conditions.push(
			`i.id IN (
                SELECT l.idea_id FROM idea_tag_links l
                JOIN idea_tags t ON t.id = l.tag_id
                WHERE t.name = ?${params.length} COLLATE NOCASE
            )`
		);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
	const rows = await driver.select<IdeaRow>(
		`SELECT ${COLUMNS} FROM ideas i ${where} ORDER BY i.created_at DESC, i.id DESC`,
		params
	);

	const ideas: Idea[] = [];
	for (const row of rows) ideas.push(await map(driver, row));
	return ideas;
}

export async function get(driver: SqlDriver, id: number): Promise<Idea> {
	const rows = await driver.select<IdeaRow>(`SELECT ${COLUMNS} FROM ideas i WHERE i.id = ?1`, [id]);
	const row = rows[0];
	if (!row) throw AppError.notFound('idea', id);
	return map(driver, row);
}

export async function create(driver: SqlDriver, input: IdeaInput): Promise<Idea> {
	const title = requiredText('idea title', input.title);
	const timestamp = now();

	const result = await driver.execute(
		'INSERT INTO ideas (title, note, promoted_goal_id, created_at, updated_at) VALUES (?1, ?2, NULL, ?3, ?3)',
		[title, optionalText(input.note), timestamp]
	);

	await setTags(driver, result.lastInsertId, input.tagNames);
	return get(driver, result.lastInsertId);
}

export async function update(driver: SqlDriver, id: number, input: IdeaInput): Promise<Idea> {
	const title = requiredText('idea title', input.title);

	const result = await driver.execute(
		'UPDATE ideas SET title = ?1, note = ?2, updated_at = ?3 WHERE id = ?4',
		[title, optionalText(input.note), now(), id]
	);
	if (result.rowsAffected === 0) throw AppError.notFound('idea', id);

	await setTags(driver, id, input.tagNames);
	return get(driver, id);
}

/** Tag links cascade-drop via FK; the tags themselves survive for reuse. */
export async function remove(driver: SqlDriver, id: number): Promise<void> {
	const result = await driver.execute('DELETE FROM ideas WHERE id = ?1', [id]);
	if (result.rowsAffected === 0) throw AppError.notFound('idea', id);
}

export async function promote(driver: SqlDriver, id: number, goalId: number): Promise<Idea> {
	const result = await driver.execute(
		'UPDATE ideas SET promoted_goal_id = ?1, updated_at = ?2 WHERE id = ?3',
		[goalId, now(), id]
	);
	if (result.rowsAffected === 0) throw AppError.notFound('idea', id);
	return get(driver, id);
}

/** Every existing tag, for the filter-chip row. */
export async function listTags(driver: SqlDriver): Promise<Tag[]> {
	const rows = await driver.select<TagRow>('SELECT id, name FROM idea_tags ORDER BY name');
	return rows.map(mapTag);
}
