import type { SqlDriver } from '../driver';
import { AppError } from '../error';
import type { Category, CategoryInput } from '../../api/types';
import { now, optionalText, requiredText } from './helpers';

const COLUMNS = 'id, name, color_token, is_default, created_at';

interface CategoryRow {
	id: number;
	name: string;
	color_token: string | null;
	is_default: number;
	created_at: string;
}

function map(row: CategoryRow): Category {
	return {
		id: row.id,
		name: row.name,
		colorToken: row.color_token,
		isDefault: Boolean(row.is_default),
		createdAt: row.created_at
	};
}

export async function list(driver: SqlDriver): Promise<Category[]> {
	const rows = await driver.select<CategoryRow>(
		`SELECT ${COLUMNS} FROM categories ORDER BY is_default DESC, name`
	);
	return rows.map(map);
}

export async function get(driver: SqlDriver, id: number): Promise<Category> {
	const rows = await driver.select<CategoryRow>(`SELECT ${COLUMNS} FROM categories WHERE id = ?1`, [
		id
	]);
	const row = rows[0];
	if (!row) throw AppError.notFound('category', id);
	return map(row);
}

export async function create(driver: SqlDriver, input: CategoryInput): Promise<Category> {
	const name = requiredText('category name', input.name);
	let result;
	try {
		result = await driver.execute(
			'INSERT INTO categories (name, color_token, is_default, created_at) VALUES (?1, ?2, 0, ?3)',
			[name, optionalText(input.colorToken), now()]
		);
	} catch (err) {
		throw duplicateNameAsValidation(err);
	}
	return get(driver, result.lastInsertId);
}

export async function update(
	driver: SqlDriver,
	id: number,
	input: CategoryInput
): Promise<Category> {
	const name = requiredText('category name', input.name);
	let result;
	try {
		result = await driver.execute(
			'UPDATE categories SET name = ?1, color_token = ?2 WHERE id = ?3',
			[name, optionalText(input.colorToken), id]
		);
	} catch (err) {
		throw duplicateNameAsValidation(err);
	}
	if (result.rowsAffected === 0) throw AppError.notFound('category', id);
	return get(driver, id);
}

/** Goals in a deleted category keep existing; their categoryId becomes NULL
 * (see the ON DELETE SET NULL rule in the schema). */
export async function remove(driver: SqlDriver, id: number): Promise<void> {
	const result = await driver.execute('DELETE FROM categories WHERE id = ?1', [id]);
	if (result.rowsAffected === 0) throw AppError.notFound('category', id);
}

/** The UNIQUE(name) constraint is a user-facing rule, not an internal failure. */
function duplicateNameAsValidation(err: unknown): AppError {
	if (err instanceof AppError) return err;
	const message = err instanceof Error ? err.message : String(err);
	if (/unique/i.test(message)) {
		return AppError.validation('a category with that name already exists');
	}
	return new AppError('database', message);
}
