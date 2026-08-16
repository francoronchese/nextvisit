import { z } from "zod";
import { appointmentSchema } from "./appointment";
import { patientSchema } from "./patient";

// POST /api/bookings response. The one-time link is delivered by email only and
// is the sole cancel/reschedule authorization (ADR-0001), so the token never
// leaves the server in the API body.
export const bookingResponseSchema = z.object({
  patient: patientSchema,
  appointment: appointmentSchema,
});

export type BookingResponse = z.infer<typeof bookingResponseSchema>;