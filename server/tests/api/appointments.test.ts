import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import app from "../../src/index";
import { truncateAll } from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

type AppointmentFixture = {
  insuranceId: string;
  doctorId: string;
  typeId: string;
};

// 2026-09-07 is a Monday; the fixture availability runs 09:00-13:00 that day.
const SLOT_DATE = "2026-09-07";

async function seedAppointmentContext(label: string): Promise<AppointmentFixture> {
  const client = await pool.connect();
  try {
    const suffix = `${label}-${Date.now()}`;
    const specialty = await client.query(
      "INSERT INTO specialties (name) VALUES ($1) RETURNING id",
      [`${suffix}-specialty`]
    );
    const specialtyId = specialty.rows[0].id as string;
    const insurance = await client.query(
      "INSERT INTO health_insurances (name, copay_amount) VALUES ($1, 12000) RETURNING id",
      [`${suffix}-insurance`]
    );
    const insuranceId = insurance.rows[0].id as string;
    const doctor = await client.query(
      "INSERT INTO doctors (specialty_id, first_name, last_name) VALUES ($1, $2, $3) RETURNING id",
      [specialtyId, "Link", "Doctor"]
    );
    const doctorId = doctor.rows[0].id as string;
    const type = await client.query(
      "INSERT INTO appointment_types (specialty_id, name, duration_minutes) VALUES ($1, $2, 30) RETURNING id",
      [specialtyId, `${suffix}-type`]
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
    return { insuranceId, doctorId, typeId };
  } finally {
    client.release();
  }
}

function bookingPayload(fixture: AppointmentFixture, dni: string, startTime: string) {
  return {
    dni,
    firstName: "Ana",
    lastName: "Pérez",
    healthInsuranceId: fixture.insuranceId,
    phone: "555-0101",
    email: "ana@example.com",
    doctorId: fixture.doctorId,
    typeId: fixture.typeId,
    date: SLOT_DATE,
    startTime,
  };
}

async function bookAndFetchToken(fixture: AppointmentFixture, dni: string, startTime: string) {
  const res = await request(app)
    .post("/api/bookings")
    .send(bookingPayload(fixture, dni, startTime))
    .expect(201);
  const appointmentId = res.body.appointment.id as string;
  const rows = await pool.query("SELECT token FROM one_time_links WHERE appointment_id = $1", [
    appointmentId,
  ]);
  return { appointmentId, token: rows.rows[0]!.token as string };
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("appointment management API", () => {
  it("GET /api/appointments/:token returns the appointment with its context", async () => {
    const fixture = await seedAppointmentContext("appt-get");
    const { token } = await bookAndFetchToken(fixture, "30111222", "09:00");

    const res = await request(app).get(`/api/appointments/${token}`).expect(200);

    expect(res.body.appointment).toMatchObject({
      doctorId: fixture.doctorId,
      appointmentTypeId: fixture.typeId,
      status: "scheduled",
      startsAt: "2026-09-07T12:00:00.000Z",
    });
    expect(res.body.patient).toMatchObject({ dni: "30111222", email: "ana@example.com" });
    expect(res.body.doctor).toMatchObject({ id: fixture.doctorId });
    expect(res.body.appointmentType).toMatchObject({ id: fixture.typeId, durationMinutes: 30 });
  });

  it("GET /api/appointments/:token with an unknown token returns 404", async () => {
    const res = await request(app)
      .get(`/api/appointments/${"b".repeat(64)}`)
      .expect(404);
    expect(res.body).toEqual({ error: "appointment link not found" });
  });

  it("POST /api/appointments/:token/cancel cancels, burns the link, and frees the slot", async () => {
    const fixture = await seedAppointmentContext("appt-cancel");
    const { token } = await bookAndFetchToken(fixture, "30222222", "09:00");

    const res = await request(app).post(`/api/appointments/${token}/cancel`).expect(200);
    expect(res.body).toMatchObject({ status: "cancelled", startsAt: "2026-09-07T12:00:00.000Z" });

    // The link is single-use: the same request must now fail.
    const again = await request(app).post(`/api/appointments/${token}/cancel`).expect(404);
    expect(again.body).toEqual({ error: "appointment link not found" });

    // The cancelled appointment frees the 09:00 slot for re-booking.
    const slots = await request(app)
      .get(`/api/doctors/${fixture.doctorId}/slots?typeId=${fixture.typeId}&date=${SLOT_DATE}`)
      .expect(200);
    expect(slots.body.find((s: { startTime: string }) => s.startTime === "09:00")).toMatchObject({
      startTime: "09:00",
      available: true,
    });
  });

  it("POST /api/appointments/:token/cancel within the 3h window returns 409", async () => {
    const fixture = await seedAppointmentContext("appt-window");
    const client = await pool.connect();
    try {
      const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const patient = await client.query(
        "INSERT INTO patients (dni, first_name, last_name, health_insurance_id, phone, email) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        ["30333333", "Ana", "Pérez", fixture.insuranceId, "555-0101", "ana@example.com"]
      );
      const appointment = await client.query(
        `INSERT INTO appointments
           (patient_id, doctor_id, appointment_type_id, starts_at, duration_minutes, booking_channel, copay_amount)
         VALUES ($1, $2, $3, $4, 30, 'web', 12000) RETURNING id`,
        [patient.rows[0].id, fixture.doctorId, fixture.typeId, startsAt]
      );
      await client.query(
        "INSERT INTO one_time_links (appointment_id, token, expires_at) VALUES ($1, $2, $3)",
        [appointment.rows[0].id, "c".repeat(64), startsAt]
      );
    } finally {
      client.release();
    }

    const res = await request(app)
      .post(`/api/appointments/${"c".repeat(64)}/cancel`)
      .expect(409);
    expect(res.body).toEqual({ error: "the cancellation window has closed" });
  });

  it("POST /api/appointments/:token/reschedule moves the appointment and issues a fresh link", async () => {
    const fixture = await seedAppointmentContext("appt-resched");
    const { token } = await bookAndFetchToken(fixture, "30444444", "09:00");

    const res = await request(app)
      .post(`/api/appointments/${token}/reschedule`)
      .send({ date: SLOT_DATE, startTime: "09:30" })
      .expect(200);
    expect(res.body).toMatchObject({ status: "scheduled", startsAt: "2026-09-07T12:30:00.000Z" });

    // Old link is dead, the new appointment got a fresh, working link.
    await request(app).get(`/api/appointments/${token}`).expect(404);
    const rows = await pool.query(
      "SELECT token FROM one_time_links WHERE appointment_id = $1 AND used_at IS NULL",
      [res.body.id]
    );
    expect(rows.rowCount).toBe(1);
    const newToken = rows.rows[0]!.token as string;
    const fresh = await request(app).get(`/api/appointments/${newToken}`).expect(200);
    expect(fresh.body.appointment.startsAt).toBe("2026-09-07T12:30:00.000Z");

    // Old slot is free again, new slot is taken.
    const slots = await request(app)
      .get(`/api/doctors/${fixture.doctorId}/slots?typeId=${fixture.typeId}&date=${SLOT_DATE}`)
      .expect(200);
    expect(slots.body.find((s: { startTime: string }) => s.startTime === "09:00")).toMatchObject({
      available: true,
    });
    expect(slots.body.find((s: { startTime: string }) => s.startTime === "09:30")).toMatchObject({
      available: false,
    });
  });

  it("POST /api/appointments/:token/reschedule onto a taken slot returns 409", async () => {
    const fixture = await seedAppointmentContext("appt-resched-taken");
    const { token } = await bookAndFetchToken(fixture, "30555555", "09:00");
    await bookAndFetchToken(fixture, "30666666", "09:30");

    const res = await request(app)
      .post(`/api/appointments/${token}/reschedule`)
      .send({ date: SLOT_DATE, startTime: "09:30" })
      .expect(409);
    expect(res.body).toEqual({ error: "that slot is no longer available" });
  });

  it("POST /api/appointments/:token/reschedule with a malformed body returns 400", async () => {
    const fixture = await seedAppointmentContext("appt-resched-400");
    const { token } = await bookAndFetchToken(fixture, "30777777", "09:00");

    const res = await request(app)
      .post(`/api/appointments/${token}/reschedule`)
      .send({ date: SLOT_DATE })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid body" });
  });

  it("rejects a token that is too short with 400", async () => {
    const res = await request(app).get(`/api/appointments/short`).expect(400);
    expect(res.body).toEqual({ error: "invalid token" });
  });
});