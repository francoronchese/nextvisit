import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import {
  getDoctorById,
  getDoctorOffersType,
  listAvailabilityBlocksForDoctor,
  listAvailabilityForDoctor,
  listBookedAppointmentsForDoctor,
} from "../../src/db/queries/slots";
import { clinicLocalToUtc } from "../../src/utils/clinicTimezone";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

type SlotFixture = {
  doctorId: string;
  patientId: string;
  typeId: string;
  insuranceId: string;
};

async function seedFixture(): Promise<SlotFixture> {
  const client = await pool.connect();
  try {
    const specialty = await client.query(
      "INSERT INTO specialties (name) VALUES ($1) RETURNING id",
      [`slots-specialty-${Date.now()}`]
    );
    const specialtyId = specialty.rows[0].id as string;
    const insurance = await client.query(
      "INSERT INTO health_insurances (name, copay_amount) VALUES ($1, 100) RETURNING id",
      [`slots-insurance-${Date.now()}`]
    );
    const insuranceId = insurance.rows[0].id as string;
    const doctor = await client.query(
      "INSERT INTO doctors (specialty_id, first_name, last_name) VALUES ($1, $2, $3) RETURNING id",
      [specialtyId, "Test", "Doctor"]
    );
    const doctorId = doctor.rows[0].id as string;
    const type = await client.query(
      "INSERT INTO appointment_types (specialty_id, name, duration_minutes) VALUES ($1, $2, $3) RETURNING id",
      [specialtyId, `slots-type-${Date.now()}`, 30]
    );
    const typeId = type.rows[0].id as string;
    await client.query(
      "INSERT INTO doctor_appointment_types (doctor_id, appointment_type_id) VALUES ($1, $2)",
      [doctorId, typeId]
    );
    const patient = await client.query(
      "INSERT INTO patients (dni, first_name, last_name, health_insurance_id, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [`${Date.now()}`, "Test", "Patient", insuranceId, "555-0100"]
    );
    const patientId = patient.rows[0].id as string;
    return { doctorId, patientId, typeId, insuranceId };
  } finally {
    client.release();
  }
}

async function insertAppointment(args: {
  doctorId: string;
  patientId: string;
  typeId: string;
  startsAt: string;
  status?: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO appointments
      (patient_id, doctor_id, appointment_type_id, starts_at, duration_minutes, booking_channel, copay_amount, status)
     VALUES ($1, $2, $3, $4, 30, 'web', 100, $5)`,
    [args.patientId, args.doctorId, args.typeId, args.startsAt, args.status ?? "scheduled"]
  );
}

async function insertAvailability(doctorId: string): Promise<void> {
  await pool.query(
    "INSERT INTO availabilities (doctor_id, weekday, start_time, end_time) VALUES ($1, 1, '09:00', '13:00')",
    [doctorId]
  );
}

async function insertBlock(doctorId: string, date: string): Promise<void> {
  await pool.query(
    "INSERT INTO availability_blocks (doctor_id, date, start_time, end_time, reason) VALUES ($1, $2, '10:00', '11:00', 'Holiday')",
    [doctorId, date]
  );
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

describe("slot source queries", () => {
  it("getDoctorById returns the doctor", async () => {
    const fixture = await seedFixture();
    const doctor = await getDoctorById(fixture.doctorId);
    expect(doctor).toMatchObject({ id: fixture.doctorId, firstName: "Test", lastName: "Doctor" });
  });

  it("getDoctorById returns undefined for an unknown doctor", async () => {
    await expect(
      getDoctorById("00000000-0000-0000-0000-000000000000")
    ).resolves.toBeUndefined();
  });

  it("getDoctorOffersType reports whether the doctor offers the type", async () => {
    const fixture = await seedFixture();
    await expect(getDoctorOffersType(fixture.doctorId, fixture.typeId)).resolves.toBe(true);
    await expect(
      getDoctorOffersType(fixture.doctorId, "00000000-0000-0000-0000-000000000000")
    ).resolves.toBe(false);
  });

  it("listAvailabilityForDoctor returns weekly windows as HH:MM strings", async () => {
    const fixture = await seedFixture();
    await insertAvailability(fixture.doctorId);
    const availability = await listAvailabilityForDoctor(fixture.doctorId);
    expect(availability).toEqual([
      {
        id: expect.any(String),
        doctorId: fixture.doctorId,
        weekday: 1,
        startTime: "09:00",
        endTime: "13:00",
      },
    ]);
  });

  it("listAvailabilityBlocksForDoctor filters blocks by date range", async () => {
    const fixture = await seedFixture();
    await insertBlock(fixture.doctorId, "2026-09-07");
    await insertBlock(fixture.doctorId, "2026-09-21");

    const inRange = await listAvailabilityBlocksForDoctor(
      fixture.doctorId,
      "2026-09-07",
      "2026-09-19"
    );
    expect(inRange).toHaveLength(1);
    expect(inRange[0]).toMatchObject({
      doctorId: fixture.doctorId,
      date: "2026-09-07",
      startTime: "10:00",
      endTime: "11:00",
      reason: "Holiday",
    });

    const outOfRange = await listAvailabilityBlocksForDoctor(
      fixture.doctorId,
      "2026-09-22",
      "2026-09-30"
    );
    expect(outOfRange).toHaveLength(0);
  });

  it("listBookedAppointmentsForDoctor returns non-cancelled appointments in UTC", async () => {
    const fixture = await seedFixture();
    const startUtc = clinicLocalToUtc("2026-09-07", "11:00").toISOString();
    await insertAppointment({ ...fixture, startsAt: startUtc });
    await insertAppointment({
      ...fixture,
      startsAt: clinicLocalToUtc("2026-09-07", "12:00").toISOString(),
      status: "cancelled",
    });

    const booked = await listBookedAppointmentsForDoctor(
      fixture.doctorId,
      new Date("2026-09-07T00:00:00.000Z"),
      new Date("2026-09-08T00:00:00.000Z")
    );
    expect(booked).toEqual([
      { startsAt: startUtc, durationMinutes: 30 },
    ]);
  });
});