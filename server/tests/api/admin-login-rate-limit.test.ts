import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import app from "../../src/index";
import { truncateAll } from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

const EMAIL = "locked@nextvisit.ar";

async function insertRecentAttempts(count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await pool.query(`INSERT INTO login_attempts (email, ip) VALUES ($1, $2)`, [EMAIL, "::ffff:127.0.0.1"]);
  }
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
  process.env.MAX_LOGIN_ATTEMPTS = "3";
});

afterAll(async () => {
  delete process.env.MAX_LOGIN_ATTEMPTS;
  await pool.end();
});

describe("admin login rate limit", () => {
  it("returns 429 once recent attempts from the same email and IP exceed the cap", async () => {
    await insertRecentAttempts(4);

    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: EMAIL, password: "whatever" })
      .expect(429);
    expect(res.body.error).toBe("too many login attempts, please try again later");
  });

  it("still counts the rejected attempt", async () => {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM login_attempts WHERE email = $1`,
      [EMAIL]
    );
    expect(rows[0].count).toBeGreaterThanOrEqual(5);
  });

  it("lets a fresh email+IP combination through under the same cap", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: "fresh@nextvisit.ar", password: "whatever" });
    // The seeded user does not exist, so credentials fail — but the limiter
    // must not be what rejected it.
    expect(res.status).toBe(401);
  });
});
