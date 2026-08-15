import { z } from "zod";
import { dateSchema, timeSchema } from "./primitives";

export const availabilityBlockSchema = z.object({
  id: z.string().uuid(),
  doctorId: z.string().uuid(),
  date: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  reason: z.string().min(1).optional(),
});

export type AvailabilityBlock = z.infer<typeof availabilityBlockSchema>;