import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import app from "../../src/index";
import { truncateAll } from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

type BookingFixture = {
  specialtyId: string;
  insuranceId: string;
  doctorId: string;
  typeId: string;
};

// 2026-09-07 is a Monday; the fixture availability runs 09:00-13:00 that day.
const SLOT_DATE = "2026-09-07";

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
      [specialtyId, "Book", "Doctor"]
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
    return { specialtyId, insuranceId, doctorId, typeId };
  } finally {
    client.release();
  }
}

function bookingPayload(fixture: BookingFixture, dni: string, startTime: string) {
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

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("booking API", () => {
  it("POST /api/bookings creates patient, appointment and one-time link, then frees nothing and marks the slot taken", async () => {
    const fixture = await seedBookingContext("book");
    const dni = "30111222";

    const res = await request(app)
      .post("/api/bookings")
      .send(bookingPayload(fixture, dni, "09:00"))
      .expect(201);

    expect(res.body.patient).toMatchObject({ dni, firstName: "Ana", email: "ana@example.com" });
    expect(res.body.appointment).toMatchObject({
      doctorId: fixture.doctorId,
      appointmentTypeId: fixture.typeId,
      bookingChannel: "web",
      status: "scheduled",
      attendance: "pending",
      copayAmount: 12000,
      copayPaid: false,
      startsAt: "2026-09-07T12:00:00.000Z",
      durationMinutes: 30,
    });
    // The one-time link never leaves the server in the API body: it is the sole
    // cancel/reschedule authorization and is delivered by email only (ADR-0001).
    expect(res.body.oneTimeLink).toBeUndefined();

    const patientRows = await pool.query(
      "SELECT dni FROM patients WHERE dni = $1",
      [dni]
    );
    expect(patientRows.rowCount).toBe(1);

    const linkRows = await pool.query(
      "SELECT token, expires_at FROM one_time_links WHERE appointment_id = $1",
      [res.body.appointment.id]
    );
    expect(linkRows.rowCount).toBe(1);
    expect(linkRows.rows[0]!.token).toMatch(/^[0-9a-f]{64}$/);
    expect(linkRows.rows[0]!.expires_at.toISOString()).toBe(
      new Date(new Date(res.body.appointment.startsAt).getTime() + 30 * 60_000).toISOString()
    );

    const slots = await request(app)
      .get(`/api/doctors/${fixture.doctorId}/slots?typeId=${fixture.typeId}&date=${SLOT_DATE}`)
      .expect(200);
    expect(slots.body.find((s: { startTime: string }) => s.startTime === "09:00")).toMatchObject({
      startTime: "09:00",
      available: false,
    });
    expect(slots.body.find((s: { startTime: string }) => s.startTime === "09:30")).toMatchObject({
      startTime: "09:30",
      available: true,
    });
  });

  it("updates the existing patient row when the DNI already exists", async () => {
    const fixture = await seedBookingContext("book-update");
    const dni = "31111111";

    const first = await request(app)
      .post("/api/bookings")
      .send(bookingPayload(fixture, dni, "09:00"))
      .expect(201);
    const patientId = first.body.patient.id;

    const second = await request(app)
      .post("/api/bookings")
      .send({ ...bookingPayload(fixture, dni, "09:30"), lastName: "Gómez" })
      .expect(201);

    expect(second.body.patient.id).toBe(patientId);
    expect(second.body.patient.lastName).toBe("Gómez");

    const rows = await pool.query("SELECT last_name FROM patients WHERE id = $1", [patientId]);
    expect(rows.rows[0]!.last_name).toBe("Gómez");
  });

  it("rejects a malformed booking payload with 400", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .send({ dni: "123", firstName: "" })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid body" });
  });

  it("rejects the 4th active future appointment for the same DNI", async () => {
    const fixture = await seedBookingContext("book-cap");
    const dni = "32222222";

    for (const startTime of ["09:00", "09:30", "10:00"]) {
      await request(app)
        .post("/api/bookings")
        .send(bookingPayload(fixture, dni, startTime))
        .expect(201);
    }

    const res = await request(app)
      .post("/api/bookings")
      .send(bookingPayload(fixture, dni, "10:30"))
      .expect(422);
    expect(res.body).toEqual({ error: "you already have 3 future appointments" });
  });

  it("rejects the second concurrent booking for the same slot", async () => {
    const fixture = await seedBookingContext("book-race");
    const firstDni = "33333333";
    const secondDni = "34444444";

    const results = await Promise.allSettled([
      request(app).post("/api/bookings").send(bookingPayload(fixture, firstDni, "09:00")),
      request(app).post("/api/bookings").send(bookingPayload(fixture, secondDni, "09:00")),
    ]);

    // Supertest resolves for any HTTP status, so assert on the statuses, not rejection.
    const statuses = results
      .map((r) => (r.status === "fulfilled" ? r.value.status : -1))
      .sort();
    expect(statuses).toEqual([201, 409]);

    const responses = results.map((r) => (r.status === "fulfilled" ? r.value : r.reason as request.Response));
    const loser = responses.find((r) => r.status === 409)!;
    expect(loser.body).toEqual({ error: "that slot is no longer available" });
  });

  it("allows two concurrent bookings for the same new DNI, upserting the single patient", async () => {
    const fixture = await seedBookingContext("book-same-dni");
    const dni = "37777777";

    const results = await Promise.allSettled([
      request(app).post("/api/bookings").send(bookingPayload(fixture, dni, "09:00")),
      request(app).post("/api/bookings").send(bookingPayload(fixture, dni, "09:30")),
    ]);

    const statuses = results
      .map((r) => (r.status === "fulfilled" ? r.value.status : -1))
      .sort();
    // Neither booking may fail with a patient-INSERT unique violation: the
    // per-DNI advisory lock serializes the upsert inside each transaction.
    expect(statuses).toEqual([201, 201]);

    const rows = await pool.query("SELECT COUNT(*)::int AS count FROM patients WHERE dni = $1", [dni]);
    expect(rows.rows[0]!.count).toBe(1);
  });

  it("rate-limits attempts per DNI once the hourly window is exceeded", async () => {
    const fixture = await seedBookingContext("book-rate-limit");
    const dni = "36666666";

    const statuses: number[] = [];
    for (const startTime of ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]) {
      const res = await request(app)
        .post("/api/bookings")
        .send(bookingPayload(fixture, dni, startTime));
      statuses.push(res.status);
    }

    // 3 succeed, the 4th and 5th hit the 3-per-DNI cap (still attempts), and
    // the 6th exceeds the attempt window and is rate-limited.
    expect(statuses).toEqual([201, 201, 201, 422, 422, 429]);
  });

  it("returns 404 for an unknown health insurance", async () => {
    const fixture = await seedBookingContext("book-404");
    const res = await request(app)
      .post("/api/bookings")
      .send({
        ...bookingPayload(fixture, "35555555", "09:00"),
        healthInsuranceId: "00000000-0000-0000-0000-000000000000",
      })
      .expect(404);
    expect(res.body).toEqual({ error: "health insurance not found" });
  });
});