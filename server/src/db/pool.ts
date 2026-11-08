import pg from 'pg';

// bigint ids and counts arrive as numbers (ids never approach 2^53 here).
pg.types.setTypeParser(20, (value) => Number(value));

export function createPool(connectionString: string): pg.Pool {
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 10_000 });
  // An idle client dropped by the server (restart, pooler timeout) emits 'error';
  // without a listener Node would crash the process. The pool replaces the client.
  pool.on('error', (err) => console.error('idle database client error', err));
  return pool;
}
