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

async function adminToken(): Promise<string> {
  const res = await request(app).post("/api/admin/login").send(ADMIN).expect(200);
  return res.body.token as string;
}

async function secretaryToken(): Promise<string> {
  const res = await request(app).post("/api/admin/login").send(SECRETARY).expect(200);
  return res.body.token as string;
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
  fixture = await seedBaseFixture(pool, "admin-insurances");
  await pool.query("INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')", [
    ADMIN.email,
    bcrypt.hashSync(ADMIN.password, 4),
  ]);
  await pool.query("INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'secretary')", [
    SECRETARY.email,
    bcrypt.hashSync(SECRETARY.password, 4),
  ]);
});

afterAll(async () => {
  await pool.end();
});

describe("admin health insurance copay API", () => {
  it("runs the full CRUD flow for the copay table", async () => {
    const token = await adminToken();

    const created = await request(app)
      .post("/api/admin/health-insurances")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Galeno", copayAmount: 9000 })
      .expect(201);
    expect(created.body).toMatchObject({ name: "Galeno", copayAmount: 9000 });
    expect(created.body).toHaveProperty("id");
    const id = created.body.id as string;

    const listed = await request(app)
      .get("/api/admin/health-insurances")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(listed.body).toContainEqual(created.body);

    const updated = await request(app)
      .put(`/api/admin/health-insurances/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Galeno", copayAmount: 9500 })
      .expect(200);
    expect(updated.body).toMatchObject({ id, name: "Galeno", copayAmount: 9500 });

    await request(app)
      .delete(`/api/admin/health-insurances/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const after = await request(app)
      .get("/api/admin/health-insurances")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(after.body.map((entry: { id: string }) => entry.id)).not.toContain(id);
  });

  it("rejects a duplicate name on create", async () => {
    const token = await adminToken();

    await request(app)
      .post("/api/admin/health-insurances")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Duplicated-Insurance", copayAmount: 4000 })
      .expect(201);

    const res = await request(app)
      .post("/api/admin/health-insurances")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Duplicated-Insurance", copayAmount: 5000 })
      .expect(409);
    expect(res.body).toEqual({
      error: "a health insurance with that name already exists",
    });
  });

  it("rejects a duplicate name on update", async () => {
    const token = await adminToken();
    const first = await request(app)
      .post("/api/admin/health-insurances")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Update-Dupe-A", copayAmount: 4000 })
      .expect(201);
    const second = await request(app)
      .post("/api/admin/health-insurances")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Update-Dupe-B", copayAmount: 4500 })
      .expect(201);

    const res = await request(app)
      .put(`/api/admin/health-insurances/${second.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: first.body.name, copayAmount: 4500 })
      .expect(409);
    expect(res.body).toEqual({
      error: "a health insurance with that name already exists",
    });
  });

  it("rejects deleting an insurance that still covers patients", async () => {
    const token = await adminToken();

    const res = await request(app)
      .delete(`/api/admin/health-insurances/${fixture.insuranceId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(409);
    expect(res.body).toEqual({
      error: "a health insurance that still covers patients cannot be deleted",
    });
  });

  it("returns 404 for updating or deleting an unknown insurance", async () => {
    const token = await adminToken();

    const update = await request(app)
      .put("/api/admin/health-insurances/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Ghost", copayAmount: 1000 })
      .expect(404);
    expect(update.body).toEqual({ error: "health insurance not found" });

    const del = await request(app)
      .delete("/api/admin/health-insurances/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
    expect(del.body).toEqual({ error: "health insurance not found" });
  });

  it("rejects a negative copay amount", async () => {
    const token = await adminToken();

    const res = await request(app)
      .post("/api/admin/health-insurances")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Negative-Insurance", copayAmount: -1 })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid body" });
  });

  it("rejects an empty name", async () => {
    const token = await adminToken();

    const res = await request(app)
      .post("/api/admin/health-insurances")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "   ", copayAmount: 1000 })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid body" });
  });

  it("forbids a secretary session from managing the copay table", async () => {
    const token = await secretaryToken();

    const getRes = await request(app)
      .get("/api/admin/health-insurances")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
    expect(getRes.body).toEqual({ error: "forbidden" });

    const postRes = await request(app)
      .post("/api/admin/health-insurances")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Nope", copayAmount: 1000 })
      .expect(403);
    expect(postRes.body).toEqual({ error: "forbidden" });
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/admin/health-insurances").expect(401);
    expect(res.body).toEqual({ error: "unauthorized" });
  });
});