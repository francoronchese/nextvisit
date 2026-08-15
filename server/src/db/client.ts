import { Pool } from "pg";
import { getDatabaseUrl } from "../../config/env";

export const pool = new Pool({
  connectionString: getDatabaseUrl(),
});

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(text, params as never[]);
  return result.rows as T[];
}

export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}