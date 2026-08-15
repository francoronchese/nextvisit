import { z } from "zod";
import { timeSchema } from "./primitives";

export const weekdaySchema = z.number().int().min(1).max(7);

export const availabilitySchema = z.object({
  id: z.string().uuid(),
  doctorId: z.string().uuid(),
  weekday: weekdaySchema,
  startTime: timeSchema,
  endTime: timeSchema,
});

export type Availability = z.infer<typeof availabilitySchema>;