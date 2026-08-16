import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import app from "../../src/index";
import { truncateAll } from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

const CREDENTIALS = {
  email: "admin@nextvisit.ar",
  password: "secret123",
};

async function seedAdminUser(): Promise<void> {
  await pool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')`,
    [CREDENTIALS.email, bcrypt.hashSync(CREDENTIALS.password, 4)]
  );
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
  await seedAdminUser();
});

afterAll(async () => {
  await pool.end();
});

describe("admin auth API", () => {
  it("POST /api/admin/login with valid credentials returns a session token and the user", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: CREDENTIALS.email, password: CREDENTIALS.password })
      .expect(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(0);
    expect(res.body.user).toEqual({
      id: expect.any(String),
      email: CREDENTIALS.email,
      role: "admin",
      createdAt: expect.any(String),
    });
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("POST /api/admin/login with a wrong password returns 401", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: CREDENTIALS.email, password: "wrong-password" })
      .expect(401);
    expect(res.body).toEqual({ error: "invalid credentials" });
  });

  it("POST /api/admin/login with an unknown email returns 401", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: "nobody@nextvisit.ar", password: CREDENTIALS.password })
      .expect(401);
    expect(res.body).toEqual({ error: "invalid credentials" });
  });

  it("POST /api/admin/login with a malformed body returns 400", async () => {
    const res = await request(app)
      .post("/api/admin/login")
      .send({ email: "not-an-email", password: "" })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid body" });
  });

  it("GET /api/admin/* without a token returns 401", async () => {
    const res = await request(app).get("/api/admin/anything").expect(401);
    expect(res.body).toEqual({ error: "unauthorized" });
  });

  it("GET /api/admin/* with an invalid token returns 401", async () => {
    const res = await request(app)
      .get("/api/admin/anything")
      .set("Authorization", "Bearer not-a-valid-token")
      .expect(401);
    expect(res.body).toEqual({ error: "unauthorized" });
  });
});