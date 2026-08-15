import { z } from "zod";
import { dateSchema, timeSchema } from "./primitives";

export const slotSchema = z.object({
  date: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  available: z.boolean(),
});

export type Slot = z.infer<typeof slotSchema>;