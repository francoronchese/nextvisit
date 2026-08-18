import { z } from "zod";
import { bookingChannelEnum, dateSchema, dniSchema, timeSchema } from "@nextvisit/shared";

// Both booking endpoints share the patient + catalog selection fields; the
// channels differ only in whether email is required and how the booking was made.
const bookingFields = {
  dni: dniSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  healthInsuranceId: z.string().uuid(),
  phone: z.string().min(1),
  doctorId: z.string().uuid(),
  typeId: z.string().uuid(),
  date: dateSchema,
  startTime: timeSchema,
};

export const bookAppointmentSchema = z.object({
  ...bookingFields,
  // Required on web bookings (CONTEXT.md: Booking Channel).
  email: z.string().email(),
});

export const secretaryBookAppointmentSchema = z.object({
  ...bookingFields,
  // Optional when the secretary books on behalf of a phone/front-desk patient
  // (CONTEXT.md: Booking Channel); without one no confirmation email goes out.
  email: z.string().email().optional(),
  // The secretary declares how the patient booked; "web" is not allowed here.
  bookingChannel: bookingChannelEnum.extract(["front_desk", "phone"]),
});
