import { z } from "zod";
import { appointmentStatusEnum, attendanceEnum, bookingChannelEnum } from "./enums";

export const appointmentSchema = z
  .object({
    id: z.string().uuid(),
    patientId: z.string().uuid(),
    doctorId: z.string().uuid(),
    appointmentTypeId: z.string().uuid(),
    startsAt: z.string().datetime(),
    durationMinutes: z.number().int().positive(),
    bookingChannel: bookingChannelEnum,
    status: appointmentStatusEnum,
    attendance: attendanceEnum,
    copayAmount: z.number().nonnegative(),
    copayPaid: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .superRefine((appointment, ctx) => {
    // No-show is a flag on ended, not a lifecycle state (ADR-0004): a non-ended
    // appointment is always pending; an ended one is attended or no_show.
    const ended = appointment.status === "ended";
    const hasAttendance = appointment.attendance === "attended" || appointment.attendance === "no_show";
    if (ended && !hasAttendance) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["attendance"],
        message: "an ended appointment must be attended or no_show",
      });
    }
    if (!ended && appointment.attendance !== "pending") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["attendance"],
        message: "a non-ended appointment must have pending attendance",
      });
    }
  });

export type Appointment = z.infer<typeof appointmentSchema>;