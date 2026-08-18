import { z } from "zod";
import { dateSchema, timeSchema } from "@nextvisit/shared";

export const tokenParamSchema = z.object({
  token: z.string().min(32).max(64),
});

export const rescheduleAppointmentSchema = z.object({
  date: dateSchema,
  startTime: timeSchema,
});

export const dateQuerySchema = z.object({
  date: dateSchema.optional(),
});

// The secretary records that the patient actually showed up together with the
// copay they paid. No-show is never sent here: the system marks it when the
// time passes (ADR-0004) and the secretary only flips it back to attended, so
// the attendance value is always "attended".
export const recordAttendanceSchema = z.object({
  attendance: z.literal("attended"),
  copayAmount: z.number().nonnegative(),
  copayPaid: z.boolean(),
});