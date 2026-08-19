import { z } from "zod";

export const bookingChannelEnum = z.enum(["web", "front_desk", "phone"]);
export type BookingChannel = z.infer<typeof bookingChannelEnum>;

export const appointmentStatusEnum = z.enum(["scheduled", "cancelled", "ended"]);
export type AppointmentStatus = z.infer<typeof appointmentStatusEnum>;

export const attendanceEnum = z.enum(["pending", "attended", "no_show"]);
export type Attendance = z.infer<typeof attendanceEnum>;

export const userRoleEnum = z.enum(["admin", "secretary", "doctor"]);
export type UserRole = z.infer<typeof userRoleEnum>;

// The roles the admin issues credentials for (CONTEXT.md: Admin creates the
// credentials for secretaries and doctors); never admin itself — that role is
// bootstrapped by the seed.
export const staffRoleEnum = z.enum(["secretary", "doctor"]);
export type StaffRole = z.infer<typeof staffRoleEnum>;

export const BLOCK_REASON_VALUES = ["holiday", "absence"] as const;
export const blockReasonEnum = z.enum(BLOCK_REASON_VALUES);
export type BlockReason = z.infer<typeof blockReasonEnum>;