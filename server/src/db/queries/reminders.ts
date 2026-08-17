import type { QueryExecutor } from "../client";
import { utcIso } from "../sql";

// Reminders go out 24h before the appointment (spec: 24h reminder before
// appointment, skipped if cancelled). The reminder job runs hourly, so the
// query picks appointments whose start falls in the next 24h window.
export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ReminderDue = {
  appointmentId: string;
  startsAt: string;
  patientFirstName: string;
  patientLastName: string;
  patientEmail: string;
  doctorName: string;
  appointmentTypeName: string;
};

export type RemindersQueries = {
  listDueForReminder(now: Date): Promise<ReminderDue[]>;
  markReminderSent(appointmentId: string): Promise<void>;
};

export function createRemindersQueries(executor: QueryExecutor): RemindersQueries {
  return {
    async listDueForReminder(now) {
      const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS).toISOString();
      return executor.query<ReminderDue>(
        `SELECT a.id AS "appointmentId",
                ${utcIso("a.starts_at")} AS "startsAt",
                p.first_name AS "patientFirstName",
                p.last_name AS "patientLastName",
                p.email AS "patientEmail",
                d.first_name || ' ' || d.last_name AS "doctorName",
                at.name AS "appointmentTypeName"
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         JOIN doctors d ON d.id = a.doctor_id
         JOIN appointment_types at ON at.id = a.appointment_type_id
         WHERE a.status = 'scheduled'
           AND a.starts_at > $1
           AND a.starts_at <= $2
           AND p.email IS NOT NULL AND p.email <> ''
           AND a.reminder_sent_at IS NULL
         ORDER BY a.starts_at`,
        [now.toISOString(), windowEnd]
      );
    },

    markReminderSent(appointmentId) {
      return executor
        .query(
          "UPDATE appointments SET reminder_sent_at = now() WHERE id = $1 AND reminder_sent_at IS NULL",
          [appointmentId]
        )
        .then(() => undefined);
    },
  };
}