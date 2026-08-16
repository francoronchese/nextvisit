import type { Pool } from "pg";

export async function truncateAll(pool: Pool): Promise<void> {
  await pool.query(
    "TRUNCATE appointments, one_time_links, booking_attempts, patients, users, doctor_appointment_types, availabilities, availability_blocks, doctors, appointment_types, health_insurances, specialties RESTART IDENTITY CASCADE"
  );
}

export type BaseFixture = {
  specialtyId: string;
  insuranceId: string;
  doctorId: string;
  typeId: string;
  patientId: string;
};

export async function seedBaseFixture(pool: Pool, prefix: string): Promise<BaseFixture> {
  const client = await pool.connect();
  try {
    const specialty = await client.query(
      "INSERT INTO specialties (name) VALUES ($1) RETURNING id",
      [`${prefix}-specialty-${Date.now()}`]
    );
    const specialtyId = specialty.rows[0].id as string;
    const insurance = await client.query(
      "INSERT INTO health_insurances (name, copay_amount) VALUES ($1, 100) RETURNING id",
      [`${prefix}-insurance-${Date.now()}`]
    );
    const insuranceId = insurance.rows[0].id as string;
    const doctor = await client.query(
      "INSERT INTO doctors (specialty_id, first_name, last_name) VALUES ($1, $2, $3) RETURNING id",
      [specialtyId, "Test", "Doctor"]
    );
    const doctorId = doctor.rows[0].id as string;
    const type = await client.query(
      "INSERT INTO appointment_types (specialty_id, name, duration_minutes) VALUES ($1, $2, $3) RETURNING id",
      [specialtyId, `${prefix}-type-${Date.now()}`, 30]
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
    return { specialtyId, insuranceId, doctorId, typeId, patientId };
  } finally {
    client.release();
  }
}

export async function insertAvailability(pool: Pool, doctorId: string): Promise<void> {
  await pool.query(
    "INSERT INTO availabilities (doctor_id, weekday, start_time, end_time) VALUES ($1, 1, '09:00', '13:00')",
    [doctorId]
  );
}

export async function insertBlock(pool: Pool, doctorId: string, date: string): Promise<void> {
  await pool.query(
    "INSERT INTO availability_blocks (doctor_id, date, start_time, end_time, reason) VALUES ($1, $2, '10:00', '11:00', 'holiday')",
    [doctorId, date]
  );
}

export async function insertAppointment(
  pool: Pool,
  args: {
    doctorId: string;
    patientId: string;
    typeId: string;
    startsAt: string;
    status?: string;
    attendance?: string;
  }
): Promise<void> {
  await pool.query(
    `INSERT INTO appointments
      (patient_id, doctor_id, appointment_type_id, starts_at, duration_minutes, booking_channel, copay_amount, status, attendance)
     VALUES ($1, $2, $3, $4, 30, 'web', 100, $5, $6)`,
    [
      args.patientId,
      args.doctorId,
      args.typeId,
      args.startsAt,
      args.status ?? "scheduled",
      args.attendance ?? "pending",
    ]
  );
}