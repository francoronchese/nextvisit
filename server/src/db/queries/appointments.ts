import type {
  Appointment,
  AppointmentDetail,
  AppointmentType,
  Doctor,
  OneTimeLink,
  Patient,
  Specialty,
} from "@nextvisit/shared";
import type { QueryExecutor } from "../client";
import { APPOINTMENT_COLUMNS, ONE_TIME_LINK_COLUMNS, PATIENT_COLUMNS } from "./bookings";
import { APPOINTMENT_TYPE_COLUMNS } from "./catalog";
import { DOCTOR_COLUMNS } from "./doctors";

export type AppointmentManagementQueries = {
  getOneTimeLinkByToken(token: string): Promise<OneTimeLink | undefined>;
  getAppointmentById(id: string): Promise<Appointment | undefined>;
  getAppointmentDetail(id: string): Promise<AppointmentDetail | undefined>;
  markOneTimeLinkUsed(id: string): Promise<void>;
  cancelAppointment(id: string): Promise<Appointment | undefined>;
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
  };
}