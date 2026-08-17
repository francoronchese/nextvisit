import type { Appointment, HealthInsurance, OneTimeLink, Patient } from "@nextvisit/shared";
import { requireRow, type QueryExecutor } from "../client";
import { utcIso } from "../sql";
import { HEALTH_INSURANCE_COLUMNS } from "./catalog";

export type PatientInput = {
  dni: string;
  firstName: string;
  lastName: string;
  healthInsuranceId: string;
  phone: string;
  email?: string;
};

export type NewAppointment = {
  patientId: string;
  doctorId: string;
  appointmentTypeId: string;
  startsAt: string;
  durationMinutes: number;
  bookingChannel: "web";
  copayAmount: number;
};

export type NewOneTimeLink = {
  appointmentId: string;
  token: string;
  expiresAt: string;
};

export type BookingQueries = {
  lockPatient(dni: string): Promise<void>;
  countActiveAppointmentsForDni(dni: string): Promise<number>;
  getHealthInsuranceById(id: string): Promise<HealthInsurance | undefined>;
  getPatientByDni(dni: string): Promise<Patient | undefined>;
  createPatient(input: PatientInput): Promise<Patient>;
  updatePatient(id: string, input: Omit<PatientInput, "dni">): Promise<Patient>;
  createAppointment(input: NewAppointment): Promise<Appointment>;
  createOneTimeLink(input: NewOneTimeLink): Promise<OneTimeLink>;
  recordBookingAttempt(dni: string): Promise<void>;
  countRecentBookingAttempts(dni: string, since: string): Promise<number>;
};

export const PATIENT_COLUMNS = `id, dni, first_name AS "firstName", last_name AS "lastName",
  health_insurance_id AS "healthInsuranceId", phone, email`;

export const APPOINTMENT_COLUMNS = `id, patient_id AS "patientId", doctor_id AS "doctorId",
  appointment_type_id AS "appointmentTypeId",
  ${utcIso("starts_at")} AS "startsAt",
  duration_minutes AS "durationMinutes",
  booking_channel AS "bookingChannel",
  status, attendance,
  copay_amount::float8 AS "copayAmount",
  copay_paid AS "copayPaid",
  ${utcIso("created_at")} AS "createdAt"`;

export const ONE_TIME_LINK_COLUMNS = `id, appointment_id AS "appointmentId", token,
  ${utcIso("created_at")} AS "createdAt",
  ${utcIso("expires_at")} AS "expiresAt",
  ${utcIso("used_at")} AS "usedAt"`;

export function createBookingQueries(executor: QueryExecutor): BookingQueries {
  return {
    async lockPatient(dni) {
      // Serializes concurrent bookings for the same DNI so the cap count, the
      // patient upsert, and the insert can never interleave (spec: cap enforced
      // inside the booking transaction). Released automatically on commit/rollback.
      await executor.query(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, [dni]);
    },

    async countActiveAppointmentsForDni(dni) {
      const row = await executor.queryOne<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         WHERE p.dni = $1 AND a.status = 'scheduled' AND a.starts_at > now()`,
        [dni]
      );
      return row?.count ?? 0;
    },

    getHealthInsuranceById(id) {
      return executor.queryOne<HealthInsurance>(
        `SELECT ${HEALTH_INSURANCE_COLUMNS}
         FROM health_insurances
         WHERE id = $1`,
        [id]
      );
    },

    getPatientByDni(dni) {
      return executor.queryOne<Patient>(
        `SELECT ${PATIENT_COLUMNS} FROM patients WHERE dni = $1`,
        [dni]
      );
    },

    async createPatient(input) {
      return requireRow(
        await executor.queryOne<Patient>(
          `INSERT INTO patients (dni, first_name, last_name, health_insurance_id, phone, email)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING ${PATIENT_COLUMNS}`,
          [input.dni, input.firstName, input.lastName, input.healthInsuranceId, input.phone, input.email ?? null]
        ),
        "create patient"
      );
    },

    async updatePatient(id, input) {
      return requireRow(
        await executor.queryOne<Patient>(
          `UPDATE patients
           SET first_name = $2, last_name = $3, health_insurance_id = $4, phone = $5, email = $6
           WHERE id = $1
           RETURNING ${PATIENT_COLUMNS}`,
          [id, input.firstName, input.lastName, input.healthInsuranceId, input.phone, input.email ?? null]
        ),
        "update patient"
      );
    },

    async createAppointment(input) {
      return requireRow(
        await executor.queryOne<Appointment>(
          `INSERT INTO appointments
            (patient_id, doctor_id, appointment_type_id, starts_at, duration_minutes, booking_channel, copay_amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING ${APPOINTMENT_COLUMNS}`,
          [
            input.patientId,
            input.doctorId,
            input.appointmentTypeId,
            input.startsAt,
            input.durationMinutes,
            input.bookingChannel,
            input.copayAmount,
          ]
        ),
        "create appointment"
      );
    },

    async createOneTimeLink(input) {
      return requireRow(
        await executor.queryOne<OneTimeLink>(
          `INSERT INTO one_time_links (appointment_id, token, expires_at)
           VALUES ($1, $2, $3)
           RETURNING ${ONE_TIME_LINK_COLUMNS}`,
          [input.appointmentId, input.token, input.expiresAt]
        ),
        "create one-time link"
      );
    },

    async recordBookingAttempt(dni) {
      await executor.query(`INSERT INTO booking_attempts (dni) VALUES ($1)`, [dni]);
    },

    async countRecentBookingAttempts(dni, since) {
      const row = await executor.queryOne<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM booking_attempts
         WHERE dni = $1 AND attempted_at >= $2`,
        [dni, since]
      );
      return row?.count ?? 0;
    },
  };
}