import { z } from "zod";
import { dateSchema, timeSchema } from "@nextvisit/shared";

export const tokenParamSchema = z.object({
  token: z.string().min(32).max(64),
});

export const rescheduleAppointmentSchema = z.object({
  date: dateSchema,
  startTime: timeSchema,
});