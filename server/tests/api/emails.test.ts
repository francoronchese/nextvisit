import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import app from "../../src/index";
import { truncateAll } from "../fixtures";

type ResendSendArgs = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
};

const { ResendMock, sendMock } = vi.hoisted(() => {
  const sendMock = vi.fn(
    (_args: ResendSendArgs): Promise<{ data: { id: string }; error: null }> =>
      Promise.resolve({ data: { id: "mock-email-id" }, error: null })
  );
  const ResendMock = class {
    emails = { send: sendMock };
  };
  return { ResendMock, sendMock };
});

// Replace the real Resend SDK before the app (and email.ts) imports it, so the
// contract test verifies emails go out without touching the network.
vi.mock("resend", () => ({ Resend: ResendMock }));

vi.hoisted(() => {
  // tests/setup.ts deletes the real key; give the notifier one here so the
  // mocked client is actually constructed and used.
  process.env.RESEND_API_KEY = "test-resend-key";
});

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

type EmailFixture = {
  insuranceId: string;
  doctorId: string;
  typeId: string;
};

// 2026-09-07 is a Monday; the fixture availability runs 09:00-13:00 that day.
const SLOT_DATE = "2026-09-07";

async function seedEmailContext(label: string): Promise<EmailFixture> {
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
      [specialtyId, "Email", "Doctor"]
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

function bookingPayload(fixture: EmailFixture, dni: string, startTime: string) {
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

async function bookAndFetchToken(fixture: EmailFixture, dni: string, startTime: string) {
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

beforeEach(() => {
  sendMock.mockClear();
});

describe("email contract (mocked Resend)", () => {
  it("POST /api/bookings sends a confirmation email with the one-time link to the patient", async () => {
    const fixture = await seedEmailContext("email-book");
    const { appointmentId } = await bookAndFetchToken(fixture, "30111222", "09:00");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [args] = sendMock.mock.calls[0]!;
    expect(args.to).toEqual(["ana@example.com"]);
    expect(args.subject).toBe("Your appointment is confirmed");
    expect(args.text).toContain("Ana Pérez");
    expect(args.text).toContain("/appointments/");

    const rows = await pool.query("SELECT token FROM one_time_links WHERE appointment_id = $1", [
      appointmentId,
    ]);
    expect(args.text).toContain(rows.rows[0]!.token);
  });

  it("POST /api/appointments/:token/cancel sends a cancellation notice", async () => {
    const fixture = await seedEmailContext("email-cancel");
    const { token } = await bookAndFetchToken(fixture, "30222222", "09:00");
    sendMock.mockClear();

    await request(app).post(`/api/appointments/${token}/cancel`).expect(200);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [args] = sendMock.mock.calls[0]!;
    expect(args.to).toEqual(["ana@example.com"]);
    expect(args.subject).toBe("Your appointment has been cancelled");
    expect(args.text).toContain("has been cancelled");
  });

  it("POST /api/appointments/:token/reschedule sends a fresh confirmation with a new one-time link", async () => {
    const fixture = await seedEmailContext("email-reschedule");
    const { token } = await bookAndFetchToken(fixture, "30333333", "09:00");
    sendMock.mockClear();

    await request(app)
      .post(`/api/appointments/${token}/reschedule`)
      .send({ date: SLOT_DATE, startTime: "09:30" })
      .expect(200);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [args] = sendMock.mock.calls[0]!;
    expect(args.subject).toBe("Your appointment has been rescheduled");
    expect(args.text).toContain("has been rescheduled");

    const rows = await pool.query(
      `SELECT token FROM one_time_links
       JOIN appointments a ON a.id = one_time_links.appointment_id
       WHERE a.starts_at = '2026-09-07T12:30:00.000Z' AND one_time_links.used_at IS NULL`
    );
    expect(rows.rowCount).toBe(1);
    expect(args.text).toContain(rows.rows[0]!.token);
  });

  it("POST /api/reminders sends reminders for scheduled appointments in the next 24h and skips cancelled ones", async () => {
    const fixture = await seedEmailContext("email-reminder");
    const now = new Date();
    const dueAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const cancelledAt = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
    const client = await pool.connect();
    try {
      const duePatient = await client.query(
        "INSERT INTO patients (dni, first_name, last_name, health_insurance_id, phone, email) VALUES ($1, 'Reminder', 'Due', $2, '555-0100', 'reminder-patient@example.com') RETURNING id",
        ["31000001", fixture.insuranceId]
      );
      const cancelledPatient = await client.query(
        "INSERT INTO patients (dni, first_name, last_name, health_insurance_id, phone, email) VALUES ($1, 'Reminder', 'Cancelled', $2, '555-0100', 'cancelled-patient@example.com') RETURNING id",
        ["31000002", fixture.insuranceId]
      );
      await client.query(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_type_id, starts_at, duration_minutes, booking_channel, copay_amount)
         VALUES ($1, $2, $3, $4, 30, 'web', 12000)`,
        [duePatient.rows[0].id, fixture.doctorId, fixture.typeId, dueAt]
      );
      await client.query(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_type_id, starts_at, duration_minutes, booking_channel, copay_amount, status)
         VALUES ($1, $2, $3, $4, 30, 'web', 12000, 'cancelled')`,
        [cancelledPatient.rows[0].id, fixture.doctorId, fixture.typeId, cancelledAt]
      );
    } finally {
      client.release();
    }

    const res = await request(app)
      .post("/api/reminders")
      .set("Authorization", "Bearer test-reminders-secret")
      .expect(200);
    expect(res.body).toEqual({ remindersSent: 1 });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [args] = sendMock.mock.calls[0]!;
    expect(args.to).toEqual(["reminder-patient@example.com"]);
    expect(args.subject).toMatch(/^Appointment reminder:/);
    expect(args.text).toContain("reminder that you have an appointment");
    expect(args.text).not.toContain("cancelled-patient@example.com");

    // The reminder is persisted so the next run does not email again.
    const reminded = await pool.query(
      "SELECT reminder_sent_at FROM appointments WHERE starts_at = $1",
      [dueAt]
    );
    expect(reminded.rows[0].reminder_sent_at).toBeTruthy();
  });

  it("POST /api/reminders refuses requests without the reminders secret", async () => {
    const res = await request(app).post("/api/reminders").expect(401);
    expect(res.body).toEqual({ error: "unauthorized" });
  });
});