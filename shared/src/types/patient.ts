import { z } from "zod";
import { dniSchema } from "./primitives";

export const patientSchema = z.object({
  id: z.string().uuid(),
  dni: dniSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  healthInsuranceId: z.string().uuid(),
  phone: z.string().min(1),
  email: z.string().email().optional(),
});

export type Patient = z.infer<typeof patientSchema>;