import type { Appointment, AppointmentDetailWithInsurance } from "@nextvisit/shared";
import { clinicLocalToUtc } from "@nextvisit/shared";
import { query, queryOne } from "../db/client";
import {
  createAppointmentManagementQueries,
  type AppointmentManagementQueries,
} from "../db/queries/appointments";
import { appointmentCancelledError, notFoundError } from "../utils/httpErrors";

export type AttendanceInput = {
  // Always "attended": no-show is set automatically and only flipped back
  // (ADR-0004), never sent by the secretary.
  attendance: "attended";
  copayAmount: number;
  copayPaid: boolean;
};

export type AttendanceService = {
  listForDay(date: string): Promise<AppointmentDetailWithInsurance[]>;
  record(id: string, input: AttendanceInput): Promise<Appointment>;
};

export type AttendanceServiceDeps = {
  queries: AppointmentManagementQueries;
};

// The clinic timezone has no DST (see the appointments_span function in
// schema.sql), so a clinic-local day is exactly 24h of UTC.
function dayUtcRange(date: string): { from: string; to: string } {
  const from = clinicLocalToUtc({ date, time: "00:00" });
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function createAttendanceService(deps: AttendanceServiceDeps): AttendanceService {
  const { queries } = deps;
  return {
    async listForDay(date) {
      const { from, to } = dayUtcRange(date);
      return queries.listAppointmentsForDay(from, to);
    },

    async record(id, input) {
      const appointment = await queries.getAppointmentById(id);
      if (!appointment) throw notFoundError("appointment");
      if (appointment.status === "cancelled") throw appointmentCancelledError();

      const updated = await queries.updateAttendance(id, input);
      if (!updated) throw notFoundError("appointment");
      return updated;
    },
  };
}

const poolQueries = createAppointmentManagementQueries({ query, queryOne });

export const attendanceService = createAttendanceService({ queries: poolQueries });