import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import app from "../../src/index";
import { insertAppointment, seedBaseFixture, truncateAll, type BaseFixture } from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

const DOCTOR = {
  email: "doc-appts@nextvisit.ar",
  password: "secret123",
};

const SECRETARY = {
  email: "doc-appts-secretary@nextvisit.ar",
  password: "secret123",
};

// 2026-09-07 in the clinic timezone (UTC-3): a 12:00Z start belongs to that day.
const STARTS_AT = "2026-09-07T12:00:00.000Z";
// Relative instants keep the "upcoming/past" split stable regardless of when the
// suite runs.
const PAST_STARTS_AT = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const FUTURE_STARTS_AT = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

let doctor: BaseFixture;
let otherDoctor: BaseFixture;

async function staffToken(email: string, password: string): Promise<string> {
  const res = await request(app)
    .post("/api/admin/login")
    .send({ email, password })
    .expect(200);
  return res.body.token as string;
}

async function doctorDni(patientId: string): Promise<string> {
  const rows = await pool.query("SELECT dni FROM patients WHERE id = $1", [patientId]);
  return rows.rows[0].dni as string;
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
  doctor = await seedBaseFixture(pool, "doc-appts");
  otherDoctor = await seedBaseFixture(pool, "doc-appts-other");
  await pool.query(
    `INSERT INTO users (email, password_hash, role, doctor_id) VALUES ($1, $2, 'doctor', $3)`,
    [DOCTOR.email, bcrypt.hashSync(DOCTOR.password, 4), doctor.doctorId]
  );
  await pool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'secretary')`,
    [SECRETARY.email, bcrypt.hashSync(SECRETARY.password, 4)]
  );
});

beforeEach(async () => {
  // Appointments are truncated between tests so the doctor's "upcoming" list
  // never inherits rows from an earlier test; the catalog, patients, and staff
  // users seeded in beforeAll stay.
  await pool.query("TRUNCATE appointments RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await pool.end();
});

describe("doctor view appointments API", () => {
  it("returns only the signed-in doctor's upcoming appointments", async () => {
    await insertAppointment(pool, { ...doctor, startsAt: FUTURE_STARTS_AT });
    await insertAppointment(pool, { ...otherDoctor, startsAt: FUTURE_STARTS_AT });
    const token = await staffToken(DOCTOR.email, DOCTOR.password);

    const res = await request(app)
      .get("/api/admin/appointments")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      appointment: { status: "scheduled" },
      appointmentType: { name: expect.any(String) },
    });
    // The single row belongs to the doctor's own patient, not the other one.
    expect(res.body[0].patient.dni).toBe(await doctorDni(doctor.patientId));
  });

  it("excludes cancelled and already-started appointments", async () => {
    await insertAppointment(pool, {
      ...doctor,
      startsAt: FUTURE_STARTS_AT,
      status: "cancelled",
    });
    await insertAppointment(pool, { ...doctor, startsAt: PAST_STARTS_AT });
    const token = await staffToken(DOCTOR.email, DOCTOR.password);

    const res = await request(app)
      .get("/api/admin/appointments")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(0);
  });

  it("rejects a doctor session trying to book (read-only panel)", async () => {
    const token = await staffToken(DOCTOR.email, DOCTOR.password);

    const res = await request(app)
      .post("/api/admin/appointments")
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(403);
    expect(res.body).toEqual({ error: "forbidden" });
  });

  it("rejects a doctor session trying to record attendance (read-only panel)", async () => {
    const token = await staffToken(DOCTOR.email, DOCTOR.password);

    const res = await request(app)
      .patch(`/api/admin/appointments/${doctor.patientId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ attendance: "attended", copayAmount: 100, copayPaid: true })
      .expect(403);
    expect(res.body).toEqual({ error: "forbidden" });
  });

  it("keeps the secretary day-list shape on the same endpoint", async () => {
    await insertAppointment(pool, { ...doctor, startsAt: STARTS_AT });
    const token = await staffToken(SECRETARY.email, SECRETARY.password);

    const res = await request(app)
      .get("/api/admin/appointments?date=2026-09-07")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      appointment: { doctorId: doctor.doctorId },
      insurance: { id: doctor.insuranceId },
    });
  });
});