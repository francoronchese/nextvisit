import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import app from "../../src/index";
import { seedBaseFixture, truncateAll } from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

const SECRETARY = {
  email: "secretary@nextvisit.ar",
  password: "secret123",
};

// 2026-09-07 is a Monday.
const MONDAY = "2026-09-07";

async function seedSecretaryUser(): Promise<void> {
  await pool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'secretary')`,
    [SECRETARY.email, bcrypt.hashSync(SECRETARY.password, 4)]
  );
}

async function secretaryToken(): Promise<string> {
  const res = await request(app)
    .post("/api/admin/login")
    .send({ email: SECRETARY.email, password: SECRETARY.password })
    .expect(200);
  return res.body.token as string;
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
  await seedSecretaryUser();
});

afterAll(async () => {
  await pool.end();
});

describe("admin availability API", () => {
  it("GET /api/admin/doctors returns all doctors", async () => {
    const fixture = await seedBaseFixture(pool, "avail-api");
    const token = await secretaryToken();
    const res = await request(app)
      .get("/api/admin/doctors")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        { id: fixture.doctorId, specialtyId: fixture.specialtyId, firstName: "Test", lastName: "Doctor" },
      ])
    );
  });

  it("GET /api/admin/doctors without a token returns 401", async () => {
    await request(app).get("/api/admin/doctors").expect(401);
  });

  it("POST /api/admin/availability creates a weekly window, GET lists it, PUT updates it, DELETE removes it", async () => {
    const fixture = await seedBaseFixture(pool, "avail-api");
    const token = await secretaryToken();

    const created = await request(app)
      .post("/api/admin/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ doctorId: fixture.doctorId, weekday: 1, startTime: "09:00", endTime: "13:00" })
      .expect(201);
    expect(created.body).toMatchObject({
      doctorId: fixture.doctorId,
      weekday: 1,
      startTime: "09:00",
      endTime: "13:00",
    });

    const listed = await request(app)
      .get("/api/admin/availability")
      .query({ doctorId: fixture.doctorId })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(listed.body).toEqual([created.body]);

    const updated = await request(app)
      .put(`/api/admin/availability/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ doctorId: fixture.doctorId, weekday: 3, startTime: "14:00", endTime: "18:00" })
      .expect(200);
    expect(updated.body).toMatchObject({ id: created.body.id, weekday: 3, startTime: "14:00", endTime: "18:00" });

    await request(app)
      .delete(`/api/admin/availability/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const afterDelete = await request(app)
      .get("/api/admin/availability")
      .query({ doctorId: fixture.doctorId })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(afterDelete.body).toEqual([]);
  });

  it("POST /api/admin/availability-blocks creates a block, GET lists it, DELETE removes it", async () => {
    const fixture = await seedBaseFixture(pool, "avail-api");
    const token = await secretaryToken();

    const created = await request(app)
      .post("/api/admin/availability-blocks")
      .set("Authorization", `Bearer ${token}`)
      .send({ doctorId: fixture.doctorId, date: MONDAY, startTime: "10:00", endTime: "11:00", reason: "holiday" })
      .expect(201);
    expect(created.body).toMatchObject({
      doctorId: fixture.doctorId,
      date: MONDAY,
      startTime: "10:00",
      endTime: "11:00",
      reason: "holiday",
    });

    const listed = await request(app)
      .get("/api/admin/availability-blocks")
      .query({ doctorId: fixture.doctorId })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(listed.body).toEqual([created.body]);

    await request(app)
      .delete(`/api/admin/availability-blocks/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const afterDelete = await request(app)
      .get("/api/admin/availability-blocks")
      .query({ doctorId: fixture.doctorId })
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(afterDelete.body).toEqual([]);
  });

  it("rejects creating availability for an unknown doctor", async () => {
    const token = await secretaryToken();
    const res = await request(app)
      .post("/api/admin/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ doctorId: "00000000-0000-0000-0000-000000000000", weekday: 1, startTime: "09:00", endTime: "13:00" })
      .expect(404);
    expect(res.body).toEqual({ error: "doctor not found" });
  });

  it("rejects a malformed body", async () => {
    const fixture = await seedBaseFixture(pool, "avail-api");
    const token = await secretaryToken();
    const res = await request(app)
      .post("/api/admin/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ doctorId: fixture.doctorId, weekday: 1, startTime: "13:00", endTime: "09:00" })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid body" });
  });

  it("rejects deleting an unknown weekly window", async () => {
    const token = await secretaryToken();
    const res = await request(app)
      .delete("/api/admin/availability/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
    expect(res.body).toEqual({ error: "availability not found" });
  });

  it("rejects deleting an unknown block", async () => {
    const token = await secretaryToken();
    const res = await request(app)
      .delete("/api/admin/availability-blocks/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
    expect(res.body).toEqual({ error: "availability block not found" });
  });

  it("rejects a block without a reason or with a reason outside the vocabulary", async () => {
    const fixture = await seedBaseFixture(pool, "avail-api");
    const token = await secretaryToken();

    const missingReason = await request(app)
      .post("/api/admin/availability-blocks")
      .set("Authorization", `Bearer ${token}`)
      .send({ doctorId: fixture.doctorId, date: MONDAY, startTime: "10:00", endTime: "11:00" })
      .expect(400);
    expect(missingReason.body).toEqual({ error: "invalid body" });

    const unknownReason = await request(app)
      .post("/api/admin/availability-blocks")
      .set("Authorization", `Bearer ${token}`)
      .send({ doctorId: fixture.doctorId, date: MONDAY, startTime: "10:00", endTime: "11:00", reason: "vacation" })
      .expect(400);
    expect(unknownReason.body).toEqual({ error: "invalid body" });
  });

  it("rejects listing availability without a doctorId", async () => {
    const token = await secretaryToken();
    const res = await request(app)
      .get("/api/admin/availability")
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
    expect(res.body).toEqual({ error: "invalid query" });
  });

  it("blocks prevent slots on those dates, and removing the block restores them", async () => {
    const fixture = await seedBaseFixture(pool, "avail-api");
    const token = await secretaryToken();

    await request(app)
      .post("/api/admin/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ doctorId: fixture.doctorId, weekday: 1, startTime: "09:00", endTime: "13:00" })
      .expect(201);

    type SlotRow = { date: string; startTime: string; available: boolean };
    const slotTimes = (slots: SlotRow[]) =>
      slots.filter((slot) => slot.date === MONDAY).map((slot) => slot.startTime);

    const before = await request(app)
      .get(`/api/doctors/${fixture.doctorId}/slots`)
      .query({ typeId: fixture.typeId, date: MONDAY })
      .expect(200);
    const availableBefore = slotTimes(before.body);
    expect(availableBefore).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"]);

    const block = await request(app)
      .post("/api/admin/availability-blocks")
      .set("Authorization", `Bearer ${token}`)
      .send({ doctorId: fixture.doctorId, date: MONDAY, startTime: "10:00", endTime: "11:00", reason: "holiday" })
      .expect(201);

    const during = await request(app)
      .get(`/api/doctors/${fixture.doctorId}/slots`)
      .query({ typeId: fixture.typeId, date: MONDAY })
      .expect(200);
    const blockedTimes = during.body
      .filter((slot: SlotRow) => slot.date === MONDAY && !slot.available)
      .map((slot: SlotRow) => slot.startTime);
    expect(blockedTimes).toEqual(["10:00", "10:30"]);

    await request(app)
      .delete(`/api/admin/availability-blocks/${block.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const after = await request(app)
      .get(`/api/doctors/${fixture.doctorId}/slots`)
      .query({ typeId: fixture.typeId, date: MONDAY })
      .expect(200);
    const availableAfter = slotTimes(after.body);
    expect(availableAfter).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"]);
  });
});