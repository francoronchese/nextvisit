import type { BookingPayload, BookingResult } from "../booking.types";
import { useCreateBooking } from "../../../hooks/useCreateBooking";

export function useBooking() {
  return useCreateBooking<BookingResult, BookingPayload>("/api/bookings");
}