import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import app from "../../src/index";
import { insertAppointment, seedBaseFixture, truncateAll } from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

const SECRETARY = {
  email: "att-secretary@nextvisit.ar",
  password: "secret123",
};

const DOCTOR = {
  email: "att-doctor@nextvisit.ar",
  password: "secret123",
};

// 2026-09-07 in the clinic timezone (UTC-3): a 12:00Z start belongs to that
// clinic-local day.
const STARTS_AT = "2026-09-07T12:00:00.000Z";
// Attendance is recorded on arrival (ADR-0004), so the record tests book
// appointments that have already started; the future-reject test books one that
// has not. Relative dates keep both cases stable regardless of when tests run.
const PAST_STARTS_AT = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const FUTURE_STARTS_AT = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

async function seedUsers(): Promise<void> {
  await pool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'secretary')`,
    [SECRETARY.email, bcrypt.hashSync(SECRETARY.password, 4)]
  );
  await pool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'doctor')`,
    [DOCTOR.email, bcrypt.hashSync(DOCTOR.password, 4)]
  );
}

async function staffToken(email: string, password: string): Promise<string> {
  const res = await request(app)
    .post("/api/admin/login")
    .send({ email, password })
    .expect(200);
  return res.body.token as string;
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
  await seedUsers();
});

afterAll(async () => {
  await pool.end();
});

describe("secretary attendance & copay API", () => {
  it("rejects marking attendance without a staff session token", async () => {
    const fixture = await seedBaseFixture(pool, "att-401");
    const appointmentId = await insertAppointment(pool, {
      ...fixture,
      startsAt: STARTS_AT,
      status: "ended",
      attendance: "no_show",
    });

    const res = await request(app)
      .patch(`/api/admin/appointments/${appointmentId}`)
      .send({ attendance: "attended", copayAmount: 5000, copayPaid: true })
      .expect(401);
    expect(res.body).toEqual({ error: "unauthorized" });
  });

  it("rejects a doctor session, whose panel is read-only (spec)", async () => {
    const fixture = await seedBaseFixture(pool, "att-403");
    const appointmentId = await insertAppointment(pool, {
      ...fixture,
      startsAt: STARTS_AT,
      status: "ended",
      attendance: "no_show",
    });
    const token = await staffToken(DOCTOR.email, DOCTOR.password);

    const res = await request(app)
      .patch(`/api/admin/appointments/${appointmentId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ attendance: "attended", copayAmount: 5000, copayPaid: true })
      .expect(403);
    expect(res.body).toEqual({ error: "forbidden" });
  });

  it("records copay and marks a no-show appointment attended (flips the automatic mark)", async () => {
    const fixture = await seedBaseFixture(pool, "att-flip");
    const appointmentId = await insertAppointment(pool, {
      ...fixture,
      startsAt: PAST_STARTS_AT,
      status: "ended",
      attendance: "no_show",
    });
    const token = await staffToken(SECRETARY.email, SECRETARY.password);

    const res = await request(app)
      .patch(`/api/admin/appointments/${appointmentId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ attendance: "attended", copayAmount: 4500, copayPaid: true })
      .expect(200);

    expect(res.body).toMatchObject({
      id: appointmentId,
      status: "ended",
      attendance: "attended",
      copayAmount: 4500,
      copayPaid: true,
    });

    const rows = await pool.query(
      "SELECT status, attendance, copay_amount, copay_paid FROM appointments WHERE id = $1",
      [appointmentId]
    );
    expect(rows.rows[0]).toEqual({
      status: "ended",
      attendance: "attended",
      copay_amount: "4500.00",
      copay_paid: true,
    });
  });

  it("ends and marks attended a scheduled appointment whose patient just arrived", async () => {
    const fixture = await seedBaseFixture(pool, "att-arrive");
    const appointmentId = await insertAppointment(pool, {
      ...fixture,
      startsAt: PAST_STARTS_AT,
    });
    const token = await staffToken(SECRETARY.email, SECRETARY.password);

    const res = await request(app)
      .patch(`/api/admin/appointments/${appointmentId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ attendance: "attended", copayAmount: 5000, copayPaid: false })
      .expect(200);

    expect(res.body).toMatchObject({
      id: appointmentId,
      status: "ended",
      attendance: "attended",
      copayAmount: 5000,
      copayPaid: false,
    });
  });

  it("rejects marking a scheduled appointment attended before it starts", async () => {
    const fixture = await seedBaseFixture(pool, "att-future");
    const appointmentId = await insertAppointment(pool, {
      ...fixture,
      startsAt: FUTURE_STARTS_AT,
    });
    const token = await staffToken(SECRETARY.email, SECRETARY.password);

    const res = await request(app)
      .patch(`/api/admin/appointments/${appointmentId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ attendance: "attended", copayAmount: 5000, copayPaid: true })
      .expect(409);
    expect(res.body).toEqual({ error: "this appointment has not started yet" });
  });

  it("rejects marking attendance on a cancelled appointment", async () => {
    const fixture = await seedBaseFixture(pool, "att-cancelled");
    const appointmentId = await insertAppointment(pool, {
      ...fixture,
      startsAt: STARTS_AT,
      status: "cancelled",
    });
    const token = await staffToken(SECRETARY.email, SECRETARY.password);

    const res = await request(app)
      .patch(`/api/admin/appointments/${appointmentId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ attendance: "attended", copayAmount: 5000, copayPaid: true })
      .expect(409);
    expect(res.body).toEqual({ error: "a cancelled appointment cannot be marked" });
  });

  it("rejects a malformed attendance payload", async () => {
    const fixture = await seedBaseFixture(pool, "att-bad");
    const appointmentId = await insertAppointment(pool, { ...fixture, startsAt: STARTS_AT });
    const token = await staffToken(SECRETARY.email, SECRETARY.password);

    const res = await request(app)
      .patch(`/api/admin/appointments/${appointmentId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ attendance: "pending", copayAmount: -1, copayPaid: "yes" })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid body" });
  });

  it("lists a day's appointments with the insurance copay pre-fill for the attendance form", async () => {
    const fixture = await seedBaseFixture(pool, "att-list");
    // A day of its own so earlier tests' appointments don't pollute the count.
    await insertAppointment(pool, { ...fixture, startsAt: "2026-09-08T12:00:00.000Z" });
    await insertAppointment(pool, {
      ...fixture,
      startsAt: "2026-09-08T12:30:00.000Z",
      status: "ended",
      attendance: "no_show",
    });
    await insertAppointment(pool, {
      ...fixture,
      startsAt: "2026-09-08T12:00:00.000Z",
      status: "cancelled",
    });
    const token = await staffToken(SECRETARY.email, SECRETARY.password);

    const res = await request(app)
      .get("/api/admin/appointments?date=2026-09-08")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    // Two non-cancelled appointments for the day, cancelled one excluded.
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      appointment: { startsAt: "2026-09-08T12:00:00.000Z", attendance: "pending" },
      patient: { healthInsuranceId: fixture.insuranceId },
      insurance: { id: fixture.insuranceId, copayAmount: 100 },
    });
  });
});