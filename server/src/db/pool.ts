import pg from 'pg';

// bigint ids and counts arrive as numbers (ids never approach 2^53 here).
pg.types.setTypeParser(20, (value) => Number(value));

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 10 });
}
