import { useResource, type ResourceState } from "../../../hooks/useResource";
import type { AppointmentDetail } from "../appointments.types";

export function useAppointment(token: string | undefined): ResourceState<AppointmentDetail> {
  const path = token ? `/api/appointments/${token}` : undefined;
  return useResource<AppointmentDetail>(path);
}