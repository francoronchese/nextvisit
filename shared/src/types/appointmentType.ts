import { z } from "zod";

export const appointmentTypeSchema = z.object({
  id: z.string().uuid(),
  specialtyId: z.string().uuid(),
  name: z.string().min(1),
  durationMinutes: z.number().int().positive(),
});

export type AppointmentType = z.infer<typeof appointmentTypeSchema>;