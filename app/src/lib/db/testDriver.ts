import { DatabaseSync } from 'node:sqlite';
import type { QueryResult, SqlDriver } from './driver';
import { TEST_SCHEMA } from './testSchema';

/** A fresh in-memory SQLite database per call, migrated to the current schema.
 * Built on node:sqlite's DatabaseSync (Node 24+, no native build step) rather
 * than better-sqlite3, which failed to compile in this environment. */
export function createTestDriver(): SqlDriver {
	const db = new DatabaseSync(':memory:');
	db.exec('PRAGMA foreign_keys = ON;');
	db.exec(TEST_SCHEMA);

	return {
		select: async <T>(sql: string, params: unknown[] = []) =>
			db.prepare(sql).all(...params) as T[],
		execute: async (sql: string, params: unknown[] = []): Promise<QueryResult> => {
			const result = db.prepare(sql).run(...params);
			return {
				lastInsertId: Number(result.lastInsertRowid),
				rowsAffected: Number(result.changes)
			};
		}
	};
}
