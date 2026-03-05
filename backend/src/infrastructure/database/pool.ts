import { Pool } from 'pg';
import { config } from '../../config';

export const pool = new Pool({
  connectionString: config.database.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: config.database.url.includes('supabase.co') || config.database.url.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: { query: typeof query; queryOne: typeof queryOne }) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txQuery = async <R = any>(text: string, params?: any[]): Promise<R[]> => {
      const result = await client.query(text, params);
      return result.rows as R[];
    };
    const txQueryOne = async <R = any>(text: string, params?: any[]): Promise<R | null> => {
      const rows = await txQuery<R>(text, params);
      return rows[0] ?? null;
    };
    const result = await fn({ query: txQuery, queryOne: txQueryOne });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
