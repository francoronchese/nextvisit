import { z } from "zod";
import { blockReasonEnum, dateSchema, timeSchema, weekdaySchema } from "@nextvisit/shared";

const timeRangeCheck = { message: "End time must be after start time." };

export const availabilityInputSchema = z
  .object({
    doctorId: z.string().uuid(),
    weekday: weekdaySchema,
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .refine((value) => value.endTime > value.startTime, timeRangeCheck);

export const availabilityBlockInputSchema = z
  .object({
    doctorId: z.string().uuid(),
    date: dateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    // Spec: blocks always carry a reason from a closed vocabulary.
    reason: blockReasonEnum,
  })
  .refine((value) => value.endTime > value.startTime, timeRangeCheck);

export const doctorIdQuerySchema = z.object({
  doctorId: z.string().uuid(),
});