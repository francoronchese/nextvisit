import { z } from "zod";
import { appointmentStatusEnum } from "./enums";

// Row of the doctor's read-only panel: an upcoming appointment with just the
// patient details a clinician needs to see who is coming. Deliberately omits
// the patient's contact fields and the copay — that PII/copay data is not
// needed here (ARCHITECTURE.md §7).
export const doctorAppointmentSchema = z.object({
  appointment: z.object({
    id: z.string().uuid(),
    startsAt: z.string().datetime(),
    durationMinutes: z.number().int().positive(),
    status: appointmentStatusEnum,
  }),
  patient: z.object({
    firstName: z.string(),
    lastName: z.string(),
    dni: z.string(),
  }),
  appointmentType: z.object({
    name: z.string(),
  }),
});

export type DoctorAppointment = z.infer<typeof doctorAppointmentSchema>;