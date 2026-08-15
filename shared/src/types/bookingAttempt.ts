import { z } from "zod";
import { dniSchema } from "./primitives";

export const bookingAttemptSchema = z.object({
  id: z.string().uuid(),
  dni: dniSchema,
  attemptedAt: z.string().datetime(),
});

export type BookingAttempt = z.infer<typeof bookingAttemptSchema>;