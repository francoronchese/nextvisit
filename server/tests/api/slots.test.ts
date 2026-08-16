import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import app from "../../src/index";
import { clinicLocalToUtc } from "../../src/utils/clinicTimezone";
import {
  insertAppointment,
  insertAvailability,
  insertBlock,
  seedBaseFixture,
  truncateAll,
} from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

// 2026-09-07 is a Monday.
const MONDAY = "2026-09-07";

async function seedSlots(): Promise<{ doctorId: string; typeId: string }> {
  const fixture = await seedBaseFixture(pool, "slots-api");
  await insertAvailability(pool, fixture.doctorId);
  await insertBlock(pool, fixture.doctorId, MONDAY);
  await insertAppointment(pool, {
    ...fixture,
    startsAt: clinicLocalToUtc(MONDAY, "11:00").toISOString(),
  });
  return { doctorId: fixture.doctorId, typeId: fixture.typeId };
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("slots API", () => {
  it("GET /api/doctors/:id/slots returns the full slot grid for a date range", async () => {
    const fixture = await seedSlots();
    const res = await request(app)
      .get(`/api/doctors/${fixture.doctorId}/slots`)
      .query({ typeId: fixture.typeId, date: MONDAY })
      .expect(200);

    const monday = res.body.filter((slot: { date: string }) => slot.date === MONDAY);
    expect(monday).toEqual([
      { date: MONDAY, startTime: "09:00", endTime: "09:30", available: true },
      { date: MONDAY, startTime: "09:30", endTime: "10:00", available: true },
      { date: MONDAY, startTime: "10:00", endTime: "10:30", available: false },
      { date: MONDAY, startTime: "10:30", endTime: "11:00", available: false },
      { date: MONDAY, startTime: "11:00", endTime: "11:30", available: false },
      { date: MONDAY, startTime: "11:30", endTime: "12:00", available: true },
      { date: MONDAY, startTime: "12:00", endTime: "12:30", available: true },
      { date: MONDAY, startTime: "12:30", endTime: "13:00", available: true },
    ]);
  });

  it("covers a 30-day range from the given date", async () => {
    const fixture = await seedSlots();
    const res = await request(app)
      .get(`/api/doctors/${fixture.doctorId}/slots`)
      .query({ typeId: fixture.typeId, date: MONDAY })
      .expect(200);

    const dates = new Set(res.body.map((slot: { date: string }) => slot.date));
    // Range is [2026-09-07, 2026-10-06]; the doctor works only Mondays, so 5 dates with slots.
    expect(dates).toEqual(new Set(["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]));
    expect(res.body.every((slot: { date: string }) => slot.date >= MONDAY && slot.date <= "2026-10-06")).toBe(true);
  });

  it("returns 404 for an unknown doctor", async () => {
    const fixture = await seedSlots();
    const res = await request(app)
      .get("/api/doctors/00000000-0000-0000-0000-000000000000/slots")
      .query({ typeId: fixture.typeId, date: MONDAY })
      .expect(404);
    expect(res.body).toEqual({ error: "doctor not found" });
  });

  it("returns 404 for an unknown appointment type", async () => {
    const fixture = await seedSlots();
    const res = await request(app)
      .get(`/api/doctors/${fixture.doctorId}/slots`)
      .query({ typeId: "00000000-0000-0000-0000-000000000000", date: MONDAY })
      .expect(404);
    expect(res.body).toEqual({ error: "appointment type not found" });
  });

  it("returns 404 when the doctor does not offer the appointment type", async () => {
    const fixture = await seedBaseFixture(pool, "slots-api-no-offer");
    const doctor = await pool.query(
      "INSERT INTO doctors (specialty_id, first_name, last_name) VALUES ($1, 'No', 'Offer') RETURNING id",
      [fixture.specialtyId]
    );
    const doctorId = doctor.rows[0].id as string;
    const res = await request(app)
      .get(`/api/doctors/${doctorId}/slots`)
      .query({ typeId: fixture.typeId, date: MONDAY })
      .expect(404);
    expect(res.body).toEqual({ error: "appointment type for this doctor not found" });
  });

  it("returns 400 for a malformed id", async () => {
    const res = await request(app)
      .get("/api/doctors/not-a-uuid/slots")
      .query({ typeId: "00000000-0000-0000-0000-000000000000", date: MONDAY })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid id" });
  });

  it("returns 400 for a malformed date", async () => {
    const fixture = await seedSlots();
    const res = await request(app)
      .get(`/api/doctors/${fixture.doctorId}/slots`)
      .query({ typeId: fixture.typeId, date: "not-a-date" })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid query" });
  });

  it("returns 400 when typeId is missing", async () => {
    const fixture = await seedSlots();
    const res = await request(app)
      .get(`/api/doctors/${fixture.doctorId}/slots`)
      .query({ date: MONDAY })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid query" });
  });
});