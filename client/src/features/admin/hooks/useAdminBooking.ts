import type { SecretaryBookingPayload, SecretaryBookingResult } from "../admin.types";
import { useCreateBooking } from "../../../hooks/useCreateBooking";

export function useAdminBooking() {
  return useCreateBooking<SecretaryBookingResult, SecretaryBookingPayload>("/api/admin/appointments");
}