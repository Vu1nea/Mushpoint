import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { TEST_SCHEMA } from './testSchema';

/** Guards the one accepted duplication point named in the migration plan:
 * TEST_SCHEMA must keep describing the same tables and columns as the real
 * migrations, even though it collapses their multi-step ALTER TABLE history
 * into the final shape directly. */

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '../../../src-tauri/migrations');

function tableNames(db: DatabaseSync): string[] {
	const rows = db
		.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
		.all() as { name: string }[];
	return rows.map((row) => row.name);
}

function columnNames(db: DatabaseSync, table: string): Set<string> {
	const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
	return new Set(rows.map((row) => row.name));
}

describe('TEST_SCHEMA', () => {
	it('describes the same tables and columns as applying the real migrations in order', () => {
		const fromTestSchema = new DatabaseSync(':memory:');
		fromTestSchema.exec(TEST_SCHEMA);

		const fromMigrations = new DatabaseSync(':memory:');
		fromMigrations.exec(readFileSync(join(migrationsDir, '0001_initial.sql'), 'utf-8'));
		fromMigrations.exec(readFileSync(join(migrationsDir, '0002_streaks.sql'), 'utf-8'));

		const testSchemaTables = tableNames(fromTestSchema);
		expect(testSchemaTables).toEqual(tableNames(fromMigrations));

		for (const table of testSchemaTables) {
			expect(columnNames(fromTestSchema, table), `columns of ${table}`).toEqual(
				columnNames(fromMigrations, table)
			);
		}
	});
});
