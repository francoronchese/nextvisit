import { z } from "zod";

export const doctorSchema = z.object({
  id: z.string().uuid(),
  specialtyId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export type Doctor = z.infer<typeof doctorSchema>;