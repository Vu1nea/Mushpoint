import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { VisionItem, VisionItemInput } from '../../api/types';
import { now, optionalText } from './helpers';

const COLUMNS = 'id, image_path, quote_text, position, created_at, updated_at';
const ORDER = 'ORDER BY position, id';

interface VisionItemRow {
	id: number;
	image_path: string | null;
	quote_text: string | null;
	position: number;
	created_at: string;
	updated_at: string;
}

function map(row: VisionItemRow): VisionItem {
	return {
		id: row.id,
		imagePath: row.image_path,
		quoteText: row.quote_text,
		position: row.position,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

/** Neither field is individually required, but at least one must carry
 * content — an empty card has nothing to show on the board. Validated here
 * (not just left to the table's CHECK constraint) so the failure is a
 * friendly AppError instead of a raw SQLite error. */
function requireContent(input: VisionItemInput): {
	imagePath: string | null;
	quoteText: string | null;
} {
	const imagePath = optionalText(input.imagePath);
	const quoteText = optionalText(input.quoteText);
	if (!imagePath && !quoteText) {
		throw AppError.validation('a vision item needs an image, a quote, or both');
	}
	return { imagePath, quoteText };
}

export async function list(driver: SqlDriver): Promise<VisionItem[]> {
	const rows = await driver.select<VisionItemRow>(`SELECT ${COLUMNS} FROM vision_items ${ORDER}`);
	return rows.map(map);
}

export async function get(driver: SqlDriver, id: number): Promise<VisionItem> {
	const rows = await driver.select<VisionItemRow>(
		`SELECT ${COLUMNS} FROM vision_items WHERE id = ?1`,
		[id]
	);
	const row = rows[0];
	if (!row) throw AppError.notFound('vision item', id);
	return map(row);
}

export async function create(driver: SqlDriver, input: VisionItemInput): Promise<VisionItem> {
	const { imagePath, quoteText } = requireContent(input);
	const nextPosition = await driver.select<{ next: number }>(
		'SELECT COALESCE(MAX(position) + 1, 0) as next FROM vision_items'
	);
	const timestamp = now();

	const result = await driver.execute(
		`INSERT INTO vision_items (image_path, quote_text, position, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4)`,
		[imagePath, quoteText, nextPosition[0].next, timestamp]
	);

	return get(driver, result.lastInsertId);
}

export async function update(
	driver: SqlDriver,
	id: number,
	input: VisionItemInput
): Promise<VisionItem> {
	const { imagePath, quoteText } = requireContent(input);
	const result = await driver.execute(
		'UPDATE vision_items SET image_path = ?1, quote_text = ?2, updated_at = ?3 WHERE id = ?4',
		[imagePath, quoteText, now(), id]
	);
	if (result.rowsAffected === 0) throw AppError.notFound('vision item', id);
	return get(driver, id);
}

export async function remove(driver: SqlDriver, id: number): Promise<void> {
	const result = await driver.execute('DELETE FROM vision_items WHERE id = ?1', [id]);
	if (result.rowsAffected === 0) throw AppError.notFound('vision item', id);
}

/** Rewrites position for every id in the given order — the full board
 * order, not a delta, mirroring how `idea.update` replaces tag links
 * wholesale rather than diffing. `SqlDriver` has no transaction primitive
 * (true of every other multi-statement repo function here too), so this is
 * a sequence of awaited single-row updates rather than one atomic batch. */
export async function reorder(driver: SqlDriver, orderedIds: number[]): Promise<void> {
	for (let position = 0; position < orderedIds.length; position++) {
		await driver.execute('UPDATE vision_items SET position = ?1 WHERE id = ?2', [
			position,
			orderedIds[position]
		]);
	}
}
