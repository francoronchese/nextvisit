import { Pool } from "pg";
import { getDatabaseUrl } from "../../config/env";

export type QueryExecutor = {
  query<T>(text: string, params?: unknown[]): Promise<T[]>;
  queryOne<T>(text: string, params?: unknown[]): Promise<T | undefined>;
};

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

export async function withTransaction<T>(
  run: (executor: QueryExecutor) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const executor: QueryExecutor = {
      async query<T2>(text: string, params?: unknown[]): Promise<T2[]> {
        const result = await client.query(text, params as never[]);
        return result.rows as T2[];
      },
      async queryOne<T2>(text: string, params?: unknown[]): Promise<T2 | undefined> {
        const result = await client.query(text, params as never[]);
        return result.rows[0] as T2 | undefined;
      },
    };
    const result = await run(executor);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}