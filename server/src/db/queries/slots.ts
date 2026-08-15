import type { Availability, AvailabilityBlock, Doctor } from "@nextvisit/shared";
import { query, queryOne } from "../client";

export type BookedAppointment = {
  startsAt: string;
  durationMinutes: number;
};

export async function getDoctorById(id: string): Promise<Doctor | undefined> {
  return queryOne<Doctor>(
    `SELECT id, specialty_id AS "specialtyId", first_name AS "firstName", last_name AS "lastName"
     FROM doctors
     WHERE id = $1`,
    [id]
  );
}

export async function getDoctorOffersType(doctorId: string, typeId: string): Promise<boolean> {
  const row = await queryOne<{ one: number }>(
    `SELECT 1
     FROM doctor_appointment_types
     WHERE doctor_id = $1 AND appointment_type_id = $2`,
    [doctorId, typeId]
  );
  return row !== undefined;
}

export async function listAvailabilityForDoctor(doctorId: string): Promise<Availability[]> {
  return query<Availability>(
    `SELECT id, doctor_id AS "doctorId", weekday,
            to_char(start_time, 'HH24:MI') AS "startTime",
            to_char(end_time, 'HH24:MI') AS "endTime"
     FROM availabilities
     WHERE doctor_id = $1
     ORDER BY weekday, start_time`,
    [doctorId]
  );
}

export async function listAvailabilityBlocksForDoctor(
  doctorId: string,
  fromDate: string,
  toDate: string
): Promise<AvailabilityBlock[]> {
  return query<AvailabilityBlock>(
    `SELECT id, doctor_id AS "doctorId", to_char(date, 'YYYY-MM-DD') AS "date",
            to_char(start_time, 'HH24:MI') AS "startTime",
            to_char(end_time, 'HH24:MI') AS "endTime", reason
     FROM availability_blocks
     WHERE doctor_id = $1 AND date >= $2 AND date <= $3
     ORDER BY date, start_time`,
    [doctorId, fromDate, toDate]
  );
}

export async function listBookedAppointmentsForDoctor(
  doctorId: string,
  fromInstant: Date,
  toInstant: Date
): Promise<BookedAppointment[]> {
  return query<BookedAppointment>(
    `SELECT to_char(starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.000"Z"') AS "startsAt",
            duration_minutes AS "durationMinutes"
     FROM appointments
     WHERE doctor_id = $1 AND status = 'scheduled' AND starts_at >= $2 AND starts_at < $3
     ORDER BY starts_at`,
    [doctorId, fromInstant, toInstant]
  );
}