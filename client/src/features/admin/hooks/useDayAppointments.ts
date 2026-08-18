import type { AppointmentDetailWithInsurance } from "../admin.types";
import { useResource } from "../../../hooks/useResource";

// The secretary's attendance list for one clinic-local day; the server pre-fills
// the copay from each patient's health insurance (spec: secretary only confirms).
export function useDayAppointments(date: string) {
  return useResource<AppointmentDetailWithInsurance[]>(
    `/api/admin/appointments?date=${date}`
  );
}