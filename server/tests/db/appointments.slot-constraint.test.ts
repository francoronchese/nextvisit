import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

async function seedFixture(): Promise<{ doctorId: string; patientId: string; typeId: string }> {
  const client = await pool.connect();
  try {
    const specialty = await client.query(
      "INSERT INTO specialties (name) VALUES ($1) RETURNING id",
      [`test-specialty-${Date.now()}`]
    );
    const specialtyId = specialty.rows[0].id;
    const insurance = await client.query(
      "INSERT INTO health_insurances (name, copay_amount) VALUES ($1, 100) RETURNING id",
      [`test-insurance-${Date.now()}`]
    );
    const insuranceId = insurance.rows[0].id;
    const doctor = await client.query(
      "INSERT INTO doctors (specialty_id, first_name, last_name) VALUES ($1, $2, $3) RETURNING id",
      [specialtyId, "Test", "Doctor"]
    );
    const doctorId = doctor.rows[0].id;
    const type = await client.query(
      "INSERT INTO appointment_types (specialty_id, name, duration_minutes) VALUES ($1, $2, $3) RETURNING id",
      [specialtyId, `test-type-${Date.now()}`, 30]
    );
    const typeId = type.rows[0].id;
    const patient = await client.query(
      "INSERT INTO patients (dni, first_name, last_name, health_insurance_id, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [`${Date.now()}`, "Test", "Patient", insuranceId, "555-0100"]
    );
    const patientId = patient.rows[0].id;
    return { doctorId, patientId, typeId };
  } finally {
    client.release();
  }
}

async function insertAppointment(args: {
  doctorId: string;
  patientId: string;
  typeId: string;
  startsAt: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO appointments
      (patient_id, doctor_id, appointment_type_id, starts_at, duration_minutes, booking_channel, copay_amount)
     VALUES ($1, $2, $3, $4, 30, 'web', 100)`,
    [args.patientId, args.doctorId, args.typeId, args.startsAt]
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

describe("appointments — unique slot constraint", () => {
  it("rejects a second appointment for the same doctor at the same start time", async () => {
    const fixture = await seedFixture();
    const startsAt = "2026-09-01T10:00:00Z";
    await insertAppointment({ ...fixture, startsAt });

    await expect(insertAppointment({ ...fixture, startsAt })).rejects.toThrow(
      /duplicate key value violates unique constraint/
    );
  });

  it("allows a second appointment for the same doctor at a different start time", async () => {
    const fixture = await seedFixture();
    await insertAppointment({ ...fixture, startsAt: "2026-09-01T10:00:00Z" });
    await expect(
      insertAppointment({ ...fixture, startsAt: "2026-09-01T11:00:00Z" })
    ).resolves.toBeUndefined();
  });

  it("allows a second appointment for a different doctor at the same start time", async () => {
    const fixture = await seedFixture();
    const other = await seedFixture();
    await insertAppointment({ ...fixture, startsAt: "2026-09-01T10:00:00Z" });
    await expect(
      insertAppointment({ ...other, startsAt: "2026-09-01T10:00:00Z" })
    ).resolves.toBeUndefined();
  });

  it("releases the slot once the appointment is cancelled", async () => {
    const fixture = await seedFixture();
    const startsAt = "2026-09-01T10:00:00Z";
    await insertAppointment({ ...fixture, startsAt });
    await pool.query(
      "UPDATE appointments SET status = 'cancelled' WHERE doctor_id = $1 AND starts_at = $2",
      [fixture.doctorId, startsAt]
    );
    await expect(insertAppointment({ ...fixture, startsAt })).resolves.toBeUndefined();
  });
});