import type { SecretaryBookingPayload, SecretaryBookingResult } from "../admin.types";
import { useCreateBooking } from "../../../hooks/useCreateBooking";

export function useSecretaryBooking() {
  return useCreateBooking<SecretaryBookingResult, SecretaryBookingPayload>("/api/admin/appointments");
}