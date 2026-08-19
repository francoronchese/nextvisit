import type { DoctorAppointment } from "../admin.types";
import { useResource } from "../../../hooks/useResource";

// The doctor's read-only panel: their own upcoming appointments, scoped on the
// server to the doctor the session's user links to.
export function useDoctorAppointments() {
  return useResource<DoctorAppointment[]>("/api/admin/appointments");
}