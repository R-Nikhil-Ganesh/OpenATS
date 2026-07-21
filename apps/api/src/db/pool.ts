import { Pool, PoolClient, QueryResult, QueryResultRow, types } from 'pg';
import { config } from '../config';

// pg leaves NUMERIC (OID 1700) as a string by default since it can exceed
// JS safe-integer precision. Our NUMERIC columns (e.g. evaluation scores)
// are all small enough that float precision is fine, and API responses
// should return real numbers rather than forcing every call site to
// remember to coerce.
types.setTypeParser(1700, (val: string) => (val === null ? null : parseFloat(val)));

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: config.db.max,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  connectionTimeoutMillis: config.db.connectionTimeoutMillis,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Basic fire-and-forget query helper (no tenant context).
 * Only use for auth bootstrap queries before tenant is known.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[DB] query(${duration}ms) rows=${result.rowCount}`);
  }
  return result;
}

/**
 * Acquires a client and wraps fn in a BEGIN/COMMIT transaction.
 * Rolls back on error.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
