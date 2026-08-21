import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import { createLoginAttemptQueries } from "../../src/db/queries/loginAttempts";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });
const HOUR_MS = 60 * 60 * 1000;

beforeAll(async () => {
  await runMigrations(pool);
});

afterAll(async () => {
  await pool.end();
});

function queries() {
  return createLoginAttemptQueries({
    async query<T>(text: string, params?: unknown[]): Promise<T[]> {
      const result = await pool.query(text, params as never[]);
      return result.rows as T[];
    },
    async queryOne<T>(text: string, params?: unknown[]): Promise<T | undefined> {
      const rows = await pool.query(text, params as never[]).then((r) => r.rows);
      return rows[0] as T | undefined;
    },
  });
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * HOUR_MS).toISOString();
}

async function insertAttemptAt(email: string, ip: string, attemptedAt: string): Promise<void> {
  await pool.query(
    `INSERT INTO login_attempts (email, ip, attempted_at) VALUES ($1, $2, $3)`,
    [email, ip, attemptedAt]
  );
}

describe("login attempt queries", () => {
  it("recordLoginAttempt inserts a row that countRecentLoginAttempts counts", async () => {
    const loginQueries = queries();
    await pool.query(`DELETE FROM login_attempts WHERE email = $1`, ["staff@nextvisit.ar"]);

    await loginQueries.recordLoginAttempt("staff@nextvisit.ar", "10.0.0.1");

    const count = await loginQueries.countRecentLoginAttempts(
      "staff@nextvisit.ar",
      "10.0.0.1",
      hoursFromNow(-1)
    );
    expect(count).toBe(1);
  });

  it("counts only attempts at or after the window start", async () => {
    const loginQueries = queries();
    await pool.query(`DELETE FROM login_attempts WHERE email = $1`, ["window@nextvisit.ar"]);
    await insertAttemptAt("window@nextvisit.ar", "10.0.0.2", hoursFromNow(-2));
    await insertAttemptAt("window@nextvisit.ar", "10.0.0.2", hoursFromNow(-0.5));
    await insertAttemptAt("window@nextvisit.ar", "10.0.0.2", hoursFromNow(0));

    const count = await loginQueries.countRecentLoginAttempts(
      "window@nextvisit.ar",
      "10.0.0.2",
      hoursFromNow(-1)
    );
    expect(count).toBe(2);
  });

  it("counts only attempts from the same email and IP", async () => {
    const loginQueries = queries();
    await pool.query(`DELETE FROM login_attempts WHERE email LIKE '%scoped%'`);
    await insertAttemptAt("a@scoped.ar", "10.0.0.3", hoursFromNow(0));
    await insertAttemptAt("b@scoped.ar", "10.0.0.3", hoursFromNow(0));
    await insertAttemptAt("a@scoped.ar", "10.0.0.4", hoursFromNow(0));

    const count = await loginQueries.countRecentLoginAttempts(
      "a@scoped.ar",
      "10.0.0.3",
      hoursFromNow(-1)
    );
    expect(count).toBe(1);
  });
});
