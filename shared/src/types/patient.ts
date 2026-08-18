import { z } from "zod";
import { dniSchema } from "./primitives";

export const patientSchema = z.object({
  id: z.string().uuid(),
  dni: dniSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  healthInsuranceId: z.string().uuid(),
  phone: z.string().min(1),
  // Email is null for front-desk/phone patients who gave none (DB returns NULL);
  // the confirmation email goes out only when one is present.
  email: z.string().email().nullish(),
});

export type Patient = z.infer<typeof patientSchema>;