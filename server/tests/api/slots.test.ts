import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import app from "../../src/index";
import { clinicLocalToUtc } from "../../src/utils/clinicTimezone";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

type SlotsFixture = {
  doctorId: string;
  patientId: string;
  typeId: string;
};

// 2026-09-07 is a Monday.
const MONDAY = "2026-09-07";

async function seedSlots(): Promise<SlotsFixture> {
  const client = await pool.connect();
  try {
    const specialty = await client.query(
      "INSERT INTO specialties (name) VALUES ($1) RETURNING id",
      [`slots-api-specialty-${Date.now()}`]
    );
    const specialtyId = specialty.rows[0].id as string;
    const insurance = await client.query(
      "INSERT INTO health_insurances (name, copay_amount) VALUES ($1, 100) RETURNING id",
      [`slots-api-insurance-${Date.now()}`]
    );
    const insuranceId = insurance.rows[0].id as string;
    const doctor = await client.query(
      "INSERT INTO doctors (specialty_id, first_name, last_name) VALUES ($1, $2, $3) RETURNING id",
      [specialtyId, "María", "González"]
    );
    const doctorId = doctor.rows[0].id as string;
    const type = await client.query(
      "INSERT INTO appointment_types (specialty_id, name, duration_minutes) VALUES ($1, $2, $3) RETURNING id",
      [specialtyId, "Cardiology consultation", 30]
    );
    const typeId = type.rows[0].id as string;
    await client.query(
      "INSERT INTO doctor_appointment_types (doctor_id, appointment_type_id) VALUES ($1, $2)",
      [doctorId, typeId]
    );
    await client.query(
      "INSERT INTO availabilities (doctor_id, weekday, start_time, end_time) VALUES ($1, 1, '09:00', '13:00')",
      [doctorId]
    );
    await client.query(
      "INSERT INTO availability_blocks (doctor_id, date, start_time, end_time, reason) VALUES ($1, $2, '10:00', '11:00', 'Holiday')",
      [doctorId, MONDAY]
    );
    const patient = await client.query(
      "INSERT INTO patients (dni, first_name, last_name, health_insurance_id, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [`${Date.now()}`, "Test", "Patient", insuranceId, "555-0100"]
    );
    const patientId = patient.rows[0].id as string;
    await client.query(
      `INSERT INTO appointments
        (patient_id, doctor_id, appointment_type_id, starts_at, duration_minutes, booking_channel, copay_amount)
       VALUES ($1, $2, $3, $4, 30, 'web', 100)`,
      [patientId, doctorId, typeId, clinicLocalToUtc(MONDAY, "11:00").toISOString()]
    );
    return { doctorId, patientId, typeId };
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  await runMigrations(pool);
  await pool.query(
    "TRUNCATE appointments, one_time_links, booking_attempts, patients, doctor_appointment_types, availabilities, availability_blocks, doctors, appointment_types, health_insurances, specialties RESTART IDENTITY CASCADE"
  );
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