export interface QueryResult {
	lastInsertId: number;
	rowsAffected: number;
}

/** The one seam between repo code and a concrete SQLite backend — the real
 * plugin-sql connection in the app, node:sqlite in tests. */
export interface SqlDriver {
	select<T>(sql: string, params?: unknown[]): Promise<T[]>;
	execute(sql: string, params?: unknown[]): Promise<QueryResult>;
}
