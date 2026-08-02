import type Database from '@tauri-apps/plugin-sql';
import type { QueryResult, SqlDriver } from './driver';

export function createPluginSqlDriver(db: Database): SqlDriver {
	return {
		select: (sql, params = []) => db.select(sql, params),
		execute: async (sql, params = []): Promise<QueryResult> => {
			const result = await db.execute(sql, params);
			return {
				lastInsertId: result.lastInsertId ?? 0,
				rowsAffected: result.rowsAffected
			};
		}
	};
}
