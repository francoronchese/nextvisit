import bcrypt from "bcryptjs";
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
// contract test verifies the confirmation email goes out without touching the
// network.
vi.mock("resend", () => ({ Resend: ResendMock }));

vi.hoisted(() => {
  // tests/setup.ts deletes the real key; give the notifier one here so the
  // mocked client is actually constructed and used.
  process.env.RESEND_API_KEY = "test-resend-key";
});

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

const SECRETARY = {
  email: "secretary@nextvisit.ar",
  password: "secret123",
};

const DOCTOR = {
  email: "doctor@nextvisit.ar",
  password: "secret123",
};

type BookingFixture = {
  insuranceId: string;
  doctorId: string;
  typeId: string;
};

// 2026-09-07 is a Monday; the fixture availability runs 09:00-13:00 that day.
const SLOT_DATE = "2026-09-07";

async function seedSecretaryUser(): Promise<void> {
  await pool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'secretary')`,
    [SECRETARY.email, bcrypt.hashSync(SECRETARY.password, 4)]
  );
}

async function seedDoctorUser(): Promise<void> {
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

async function secretaryToken(): Promise<string> {
  return staffToken(SECRETARY.email, SECRETARY.password);
}

async function seedBookingContext(label: string): Promise<BookingFixture> {
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
      [specialtyId, "Desk", "Doctor"]
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

function bookingPayload(
  fixture: BookingFixture,
  dni: string,
  startTime: string,
  bookingChannel: "front_desk" | "phone" = "front_desk"
) {
  return {
    dni,
    firstName: "Ana",
    lastName: "Pérez",
    healthInsuranceId: fixture.insuranceId,
    phone: "555-0101",
    doctorId: fixture.doctorId,
    typeId: fixture.typeId,
    date: SLOT_DATE,
    startTime,
    bookingChannel,
  };
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
  await seedSecretaryUser();
  await seedDoctorUser();
});

afterAll(async () => {
  await pool.end();
});

beforeEach(() => {
  sendMock.mockClear();
});

describe("admin secretary booking API", () => {
  it("rejects a booking without a staff session token", async () => {
    const fixture = await seedBookingContext("desk-401");
    const res = await request(app)
      .post("/api/admin/appointments")
      .send(bookingPayload(fixture, "30111222", "09:00"))
      .expect(401);
    expect(res.body).toEqual({ error: "unauthorized" });
  });

  it("rejects a doctor session, whose panel is read-only (spec)", async () => {
    const fixture = await seedBookingContext("desk-403");
    const token = await staffToken(DOCTOR.email, DOCTOR.password);
    const res = await request(app)
      .post("/api/admin/appointments")
      .set("Authorization", `Bearer ${token}`)
      .send(bookingPayload(fixture, "30111222", "09:00"))
      .expect(403);
    expect(res.body).toEqual({ error: "forbidden" });
  });

  it("books on behalf through the front desk and sends the confirmation email when an email is given", async () => {
    const fixture = await seedBookingContext("desk-book");
    const token = await secretaryToken();
    const dni = "30111222";

    const res = await request(app)
      .post("/api/admin/appointments")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...bookingPayload(fixture, dni, "09:00"), email: "ana@example.com" })
      .expect(201);

    expect(res.body.appointment).toMatchObject({
      doctorId: fixture.doctorId,
      appointmentTypeId: fixture.typeId,
      bookingChannel: "front_desk",
      status: "scheduled",
      startsAt: "2026-09-07T12:00:00.000Z",
      copayAmount: 12000,
    });
    expect(res.body.patient).toMatchObject({ dni, firstName: "Ana", email: "ana@example.com" });

    const rows = await pool.query("SELECT email FROM patients WHERE dni = $1", [dni]);
    expect(rows.rows[0]!.email).toBe("ana@example.com");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [args] = sendMock.mock.calls[0]!;
    expect(args.to).toEqual(["ana@example.com"]);
    expect(args.subject).toBe("Your appointment is confirmed");
    expect(args.text).toContain("/appointments/");
  });

  it("books by phone with an email-less patient and sends no confirmation email", async () => {
    const fixture = await seedBookingContext("desk-nomail");
    const token = await secretaryToken();
    const dni = "31111111";

    const res = await request(app)
      .post("/api/admin/appointments")
      .set("Authorization", `Bearer ${token}`)
      .send(bookingPayload(fixture, dni, "09:00", "phone"))
      .expect(201);

    expect(res.body.appointment.bookingChannel).toBe("phone");
    expect(res.body.patient.email).toBeNull();

    const rows = await pool.query("SELECT email FROM patients WHERE dni = $1", [dni]);
    expect(rows.rows[0]!.email).toBeNull();

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("applies the 3-per-DNI cap across booking channels", async () => {
    const fixture = await seedBookingContext("desk-cap");
    const token = await secretaryToken();
    const dni = "32222222";

    for (const startTime of ["09:00", "09:30", "10:00"]) {
      await request(app)
        .post("/api/admin/appointments")
        .set("Authorization", `Bearer ${token}`)
        .send(bookingPayload(fixture, dni, startTime))
        .expect(201);
    }

    const res = await request(app)
      .post("/api/admin/appointments")
      .set("Authorization", `Bearer ${token}`)
      .send(bookingPayload(fixture, dni, "10:30"))
      .expect(422);
    expect(res.body).toEqual({ error: "you already have 3 future appointments" });
  });

  it("never rate-limits secretary bookings (anti-spam guards the web channel only)", async () => {
    // A web booking would hit the 5-per-hour DNI limit on the 6th attempt; the
    // secretary path must sail past it. The 3-per-DNI cap still applies, so the
    // 4th+ attempts fail on the cap — and never on a 429.
    const fixture = await seedBookingContext("desk-norate");
    const token = await secretaryToken();
    const dni = "34444444";
    const statuses: number[] = [];

    for (const startTime of ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]) {
      const res = await request(app)
        .post("/api/admin/appointments")
        .set("Authorization", `Bearer ${token}`)
        .send(bookingPayload(fixture, dni, startTime));
      statuses.push(res.status);
    }

    expect(statuses).toEqual([201, 201, 201, 422, 422, 422]);
    expect(statuses).not.toContain(429);
  });

  it("rejects a booking channel outside the secretary vocabulary", async () => {
    const fixture = await seedBookingContext("desk-channel");
    const token = await secretaryToken();
    const res = await request(app)
      .post("/api/admin/appointments")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...bookingPayload(fixture, "33333333", "09:00"), bookingChannel: "web" })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid body" });
  });

  it("rejects a malformed booking payload", async () => {
    const fixture = await seedBookingContext("desk-bad");
    const token = await secretaryToken();
    const res = await request(app)
      .post("/api/admin/appointments")
      .set("Authorization", `Bearer ${token}`)
      .send({ dni: "123", bookingChannel: "front_desk" })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid body" });
  });
});
