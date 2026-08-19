import type {
  Appointment,
  AppointmentDetail,
  AppointmentDetailWithInsurance,
  AppointmentType,
  Doctor,
  DoctorAppointment,
  OneTimeLink,
  Patient,
  Specialty,
} from "@nextvisit/shared";
import type { QueryExecutor } from "../client";
import { utcIso } from "../sql";
import { APPOINTMENT_COLUMNS, ONE_TIME_LINK_COLUMNS, PATIENT_COLUMNS } from "./bookings";
import { APPOINTMENT_TYPE_COLUMNS } from "./catalog";
import { DOCTOR_COLUMNS } from "./doctors";

export type AppointmentManagementQueries = {
  getOneTimeLinkByToken(token: string): Promise<OneTimeLink | undefined>;
  getAppointmentById(id: string): Promise<Appointment | undefined>;
  getAppointmentDetail(id: string): Promise<AppointmentDetail | undefined>;
  markOneTimeLinkUsed(id: string): Promise<void>;
  cancelAppointment(id: string): Promise<Appointment | undefined>;
  listAppointmentsForDay(fromUtc: string, toUtc: string): Promise<AppointmentDetailWithInsurance[]>;
  updateAttendance(
    id: string,
    input: { attendance: "attended"; copayAmount: number; copayPaid: boolean }
  ): Promise<Appointment | undefined>;
};

export type DoctorAppointmentQueries = {
  listUpcomingForDoctor(doctorId: string): Promise<DoctorAppointment[]>;
};

export function createAppointmentManagementQueries(
  executor: QueryExecutor
): AppointmentManagementQueries {
  return {
    getOneTimeLinkByToken(token) {
      return executor.queryOne<OneTimeLink>(
        `SELECT ${ONE_TIME_LINK_COLUMNS} FROM one_time_links WHERE token = $1`,
        [token]
      );
    },

    getAppointmentById(id) {
      return executor.queryOne<Appointment>(
        `SELECT ${APPOINTMENT_COLUMNS} FROM appointments WHERE id = $1`,
        [id]
      );
    },

    async getAppointmentDetail(id) {
      const appointment = await executor.queryOne<Appointment>(
        `SELECT ${APPOINTMENT_COLUMNS} FROM appointments WHERE id = $1`,
        [id]
      );
      if (!appointment) return undefined;

      const [patient, doctor, appointmentType] = await Promise.all([
        executor.queryOne<Patient>(`SELECT ${PATIENT_COLUMNS} FROM patients WHERE id = $1`, [
          appointment.patientId,
        ]),
        executor.queryOne<Doctor>(`SELECT ${DOCTOR_COLUMNS} FROM doctors WHERE id = $1`, [
          appointment.doctorId,
        ]),
        executor.queryOne<AppointmentType>(
          `SELECT ${APPOINTMENT_TYPE_COLUMNS} FROM appointment_types WHERE id = $1`,
          [appointment.appointmentTypeId]
        ),
      ]);
      if (!patient || !doctor || !appointmentType) return undefined;

      const specialty = await executor.queryOne<Specialty>(
        "SELECT id, name FROM specialties WHERE id = $1",
        [doctor.specialtyId]
      );
      if (!specialty) return undefined;

      return { appointment, patient, doctor, specialty, appointmentType };
    },

    markOneTimeLinkUsed(id) {
      return executor
        .query("UPDATE one_time_links SET used_at = now() WHERE id = $1 AND used_at IS NULL", [id])
        .then(() => undefined);
    },

    cancelAppointment(id) {
      return executor.queryOne<Appointment>(
        `UPDATE appointments SET status = 'cancelled'
         WHERE id = $1 AND status = 'scheduled'
         RETURNING ${APPOINTMENT_COLUMNS}`,
        [id]
      );
    },

    // One joined query assembles the nested secretary view (appointment +
    // patient + doctor + specialty + type + insurance) so a whole day loads in
    // a single round trip. json_build_object hands back the nested shape
    // directly; pg parses json columns into plain objects.
    listAppointmentsForDay(fromUtc, toUtc) {
      return executor.query<AppointmentDetailWithInsurance>(
        `SELECT
           json_build_object(
             'id', a.id,
             'patientId', a.patient_id,
             'doctorId', a.doctor_id,
             'appointmentTypeId', a.appointment_type_id,
             'startsAt', ${utcIso("a.starts_at")},
             'durationMinutes', a.duration_minutes,
             'bookingChannel', a.booking_channel,
             'status', a.status,
             'attendance', a.attendance,
             'copayAmount', a.copay_amount::float8,
             'copayPaid', a.copay_paid,
             'createdAt', ${utcIso("a.created_at")}
           ) AS appointment,
           json_build_object(
             'id', p.id,
             'dni', p.dni,
             'firstName', p.first_name,
             'lastName', p.last_name,
             'healthInsuranceId', p.health_insurance_id,
             'phone', p.phone,
             'email', p.email
           ) AS patient,
           json_build_object(
             'id', d.id,
             'specialtyId', d.specialty_id,
             'firstName', d.first_name,
             'lastName', d.last_name
           ) AS doctor,
           json_build_object('id', s.id, 'name', s.name) AS specialty,
           json_build_object(
             'id', at.id,
             'specialtyId', at.specialty_id,
             'name', at.name,
             'durationMinutes', at.duration_minutes
           ) AS "appointmentType",
           json_build_object(
             'id', hi.id,
             'name', hi.name,
             'copayAmount', hi.copay_amount::float8
           ) AS insurance
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         JOIN doctors d ON d.id = a.doctor_id
         JOIN specialties s ON s.id = d.specialty_id
         JOIN appointment_types at ON at.id = a.appointment_type_id
         JOIN health_insurances hi ON hi.id = p.health_insurance_id
         WHERE a.starts_at >= $1 AND a.starts_at < $2 AND a.status <> 'cancelled'
         ORDER BY a.starts_at`,
        [fromUtc, toUtc]
      );
    },

    // Recording that the patient showed up ends the appointment: the secretary
    // marks a patient who is here now, so the scheduled slot is over either
    // way. Only started appointments accept the update — attendance is recorded
    // on arrival, never before the slot begins (ADR-0004). A cancelled one
    // never gets attendance.
    updateAttendance(id, input) {
      return executor.queryOne<Appointment>(
        `UPDATE appointments
         SET status = 'ended', attendance = $2, copay_amount = $3, copay_paid = $4
         WHERE id = $1 AND status <> 'cancelled' AND starts_at <= now()
         RETURNING ${APPOINTMENT_COLUMNS}`,
        [id, input.attendance, input.copayAmount, input.copayPaid]
      );
    },
  };
}

export function createDoctorAppointmentQueries(
  executor: QueryExecutor
): DoctorAppointmentQueries {
  return {
    // The doctor panel shows only future, live appointments for the signed-in
    // doctor. The lean row carries just what the read-only list renders.
    listUpcomingForDoctor(doctorId) {
      return executor.query<DoctorAppointment>(
        `SELECT
           json_build_object(
             'id', a.id,
             'startsAt', ${utcIso("a.starts_at")},
             'durationMinutes', a.duration_minutes,
             'status', a.status
           ) AS appointment,
           json_build_object(
             'firstName', p.first_name,
             'lastName', p.last_name,
             'dni', p.dni
           ) AS patient,
           json_build_object('name', at.name) AS "appointmentType"
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         JOIN appointment_types at ON at.id = a.appointment_type_id
         WHERE a.doctor_id = $1 AND a.starts_at >= now() AND a.status <> 'cancelled'
         ORDER BY a.starts_at`,
        [doctorId]
      );
    },
  };
}