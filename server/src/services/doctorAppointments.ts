import type { DoctorAppointment } from "@nextvisit/shared";
import { query, queryOne } from "../db/client";
import {
  createDoctorAppointmentQueries,
  type DoctorAppointmentQueries,
} from "../db/queries/appointments";

export type DoctorAppointmentService = {
  listUpcoming(doctorId: string | undefined): Promise<DoctorAppointment[]>;
};

export function createDoctorAppointmentService(
  queries: DoctorAppointmentQueries
): DoctorAppointmentService {
  return {
    // A doctor session is only ever shown the appointments of the doctor its
    // user row links to; a user created without that link has nothing to list.
    async listUpcoming(doctorId) {
      if (!doctorId) return [];
      return queries.listUpcomingForDoctor(doctorId);
    },
  };
}

const poolQueries = createDoctorAppointmentQueries({ query, queryOne });

export const doctorAppointmentsService = createDoctorAppointmentService(poolQueries);