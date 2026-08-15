import { z } from "zod";

export const doctorAppointmentTypeSchema = z.object({
  doctorId: z.string().uuid(),
  appointmentTypeId: z.string().uuid(),
});

export type DoctorAppointmentType = z.infer<typeof doctorAppointmentTypeSchema>;