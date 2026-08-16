import { z } from "zod";
import { dateSchema, dniSchema, timeSchema } from "@nextvisit/shared";

export const bookAppointmentSchema = z.object({
  dni: dniSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  healthInsuranceId: z.string().uuid(),
  phone: z.string().min(1),
  // Required on web bookings; optional only for secretary bookings (CONTEXT.md).
  email: z.string().email(),
  doctorId: z.string().uuid(),
  typeId: z.string().uuid(),
  date: dateSchema,
  startTime: timeSchema,
});