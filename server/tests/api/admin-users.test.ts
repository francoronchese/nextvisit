import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import app from "../../src/index";
import { seedBaseFixture, truncateAll, type BaseFixture } from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

const ADMIN = { email: "admin@nextvisit.ar", password: "secret123" };
const SECRETARY = { email: "secretary@nextvisit.ar", password: "secret123" };

let fixture: BaseFixture;

async function seedUser(
  email: string,
  password: string,
  role: string,
  doctorId?: string
): Promise<void> {
  await pool.query(
    `INSERT INTO users (email, password_hash, role, doctor_id) VALUES ($1, $2, $3, $4)`,
    [email, bcrypt.hashSync(password, 4), role, doctorId ?? null]
  );
}

async function adminToken(): Promise<string> {
  const res = await request(app).post("/api/admin/login").send(ADMIN).expect(200);
  return res.body.token as string;
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
  fixture = await seedBaseFixture(pool, "admin-users");
  await seedUser(ADMIN.email, ADMIN.password, "admin");
  await seedUser(SECRETARY.email, SECRETARY.password, "secretary");
});

afterAll(async () => {
  await pool.end();
});

describe("admin staff credentials API", () => {
  it("admin creates a secretary user who can then log in", async () => {
    const token = await adminToken();
    const email = `new-secretary-${Date.now()}@nextvisit.ar`;

    const created = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email, password: "secret123", role: "secretary" })
      .expect(201);
    expect(created.body).toMatchObject({ email, role: "secretary" });
    expect(created.body).not.toHaveProperty("passwordHash");

    // Password hashed before storage: the row never carries the plain value.
    const row = await pool.query("SELECT password_hash FROM users WHERE email = $1", [email]);
    expect(row.rows[0].password_hash).not.toBe("secret123");

    const login = await request(app)
      .post("/api/admin/login")
      .send({ email, password: "secret123" })
      .expect(200);
    expect(login.body.user).toMatchObject({ email, role: "secretary" });
  });

  it("admin creates a doctor user linked to a doctor record, who can then log in", async () => {
    const token = await adminToken();
    const email = `new-doctor-${Date.now()}@nextvisit.ar`;

    const created = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email, password: "secret123", role: "doctor", doctorId: fixture.doctorId })
      .expect(201);
    expect(created.body).toMatchObject({ email, role: "doctor", doctorId: fixture.doctorId });

    const login = await request(app)
      .post("/api/admin/login")
      .send({ email, password: "secret123" })
      .expect(200);
    expect(login.body.user).toMatchObject({ email, role: "doctor", doctorId: fixture.doctorId });
  });

  it("GET /api/admin/users lists all staff users", async () => {
    const token = await adminToken();

    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const emails = res.body.map((user: { email: string }) => user.email);
    expect(emails).toContain(ADMIN.email);
    expect(emails).toContain(SECRETARY.email);
    for (const user of res.body) {
      expect(user).not.toHaveProperty("passwordHash");
    }
  });

  it("rejects a duplicate email", async () => {
    const token = await adminToken();

    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: SECRETARY.email, password: "secret123", role: "secretary" })
      .expect(409);
    expect(res.body).toEqual({ error: "a user with that email already exists" });
  });

  it("rejects creating a user for an unknown doctor", async () => {
    const token = await adminToken();

    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "ghost-doctor@nextvisit.ar",
        password: "secret123",
        role: "doctor",
        doctorId: "00000000-0000-0000-0000-000000000000",
      })
      .expect(404);
    expect(res.body).toEqual({ error: "doctor not found" });
  });

  it("rejects a doctor user without a doctor link", async () => {
    const token = await adminToken();

    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "unlinked-doctor@nextvisit.ar", password: "secret123", role: "doctor" })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid body" });
  });

  it("rejects a secretary user carrying a doctor link", async () => {
    const token = await adminToken();

    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "odd-secretary@nextvisit.ar",
        password: "secret123",
        role: "secretary",
        doctorId: fixture.doctorId,
      })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid body" });
  });

  it("rejects a role outside the credential vocabulary", async () => {
    const token = await adminToken();

    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "wannabe@nextvisit.ar", password: "secret123", role: "admin" })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid body" });
  });

  it("forbids a secretary session from managing credentials", async () => {
    const secretaryLogin = await request(app)
      .post("/api/admin/login")
      .send(SECRETARY)
      .expect(200);
    const token = secretaryLogin.body.token as string;

    const getRes = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
    expect(getRes.body).toEqual({ error: "forbidden" });

    const postRes = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "nope@nextvisit.ar", password: "secret123", role: "secretary" })
      .expect(403);
    expect(postRes.body).toEqual({ error: "forbidden" });
  });
});