import type { Availability, AvailabilityBlock, Doctor } from "@nextvisit/shared";
import type { QueryExecutor } from "../client";
import { query, queryOne } from "../client";
import { utcIso } from "../sql";
import { getDoctorByIdVia } from "./doctors";
import { AVAILABILITY_BLOCK_COLUMNS, AVAILABILITY_COLUMNS } from "./availability";

export type BookedAppointment = {
  startsAt: string;
  durationMinutes: number;
};

export type SlotQueries = {
  getDoctorById(id: string): Promise<Doctor | undefined>;
  getDoctorOffersType(doctorId: string, typeId: string): Promise<boolean>;
  listAvailabilityForDoctor(doctorId: string): Promise<Availability[]>;
  listAvailabilityBlocksForDoctor(
    doctorId: string,
    fromDate: string,
    toDate: string
  ): Promise<AvailabilityBlock[]>;
  listBookedAppointmentsForDoctor(
    doctorId: string,
    fromInstant: Date,
    toInstant: Date
  ): Promise<BookedAppointment[]>;
};

// The slots service can be built over the pool (browsing, booking fast-path) or
// over a transaction (reschedule must see the tx snapshot), so the SQL is bound
// to whatever executor the caller provides.
export function createSlotQueries(executor: QueryExecutor): SlotQueries {
  return {
    getDoctorById(id) {
      return getDoctorByIdVia(executor, id);
    },

    async getDoctorOffersType(doctorId, typeId) {
      const row = await executor.queryOne<{ offered: number }>(
        `SELECT 1 AS offered
         FROM doctor_appointment_types
         WHERE doctor_id = $1 AND appointment_type_id = $2`,
        [doctorId, typeId]
      );
      return row !== undefined;
    },

    listAvailabilityForDoctor(doctorId) {
      return executor.query<Availability>(
        `SELECT ${AVAILABILITY_COLUMNS}
         FROM availabilities
         WHERE doctor_id = $1
         ORDER BY weekday, start_time`,
        [doctorId]
      );
    },

    listAvailabilityBlocksForDoctor(doctorId, fromDate, toDate) {
      return executor.query<AvailabilityBlock>(
        `SELECT ${AVAILABILITY_BLOCK_COLUMNS}
         FROM availability_blocks
         WHERE doctor_id = $1 AND date >= $2 AND date <= $3
         ORDER BY date, start_time`,
        [doctorId, fromDate, toDate]
      );
    },

    listBookedAppointmentsForDoctor(doctorId, fromInstant, toInstant) {
      return executor.query<BookedAppointment>(
        `SELECT ${utcIso("starts_at")} AS "startsAt",
                duration_minutes AS "durationMinutes"
         FROM appointments
         WHERE doctor_id = $1 AND status = 'scheduled' AND starts_at >= $2 AND starts_at < $3
         ORDER BY starts_at`,
        [doctorId, fromInstant, toInstant]
      );
    },
  };
}

export const slotQueries = createSlotQueries({ query, queryOne });