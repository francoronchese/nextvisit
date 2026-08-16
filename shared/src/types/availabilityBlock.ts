import { z } from "zod";
import { blockReasonEnum } from "./enums";
import { dateSchema, timeSchema } from "./primitives";

export const availabilityBlockSchema = z.object({
  id: z.string().uuid(),
  doctorId: z.string().uuid(),
  date: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  reason: blockReasonEnum,
});

export type AvailabilityBlock = z.infer<typeof availabilityBlockSchema>;