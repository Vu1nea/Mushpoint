import type { PoolClient } from 'pg';
import type { QueryResult, SqlDriver } from './driver';

const PLACEHOLDER = /\?(\d+)/g;
/** Repos use ?N placeholders; none of their SQL has a literal '?' in a string. */
export const toPg = (sql: string): string => sql.replace(PLACEHOLDER, '$$$1');

export function createPgDriver(client: PoolClient): SqlDriver {
  return {
    async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return (await client.query(toPg(sql), params)).rows as T[];
    },
    async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
      const result = await client.query(toPg(sql), params);
      const first = result.rows[0] as { id?: unknown } | undefined;
      return {
        lastInsertId: typeof first?.id === 'number' ? first.id : 0,
        rowsAffected: result.rowCount ?? 0
      };
    }
  };
}
