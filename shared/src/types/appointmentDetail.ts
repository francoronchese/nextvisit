import { z } from "zod";
import { appointmentSchema } from "./appointment";
import { appointmentTypeSchema } from "./appointmentType";
import { doctorSchema } from "./doctor";
import { patientSchema } from "./patient";
import { specialtySchema } from "./specialty";

// GET /api/appointments/:token body: the appointment plus the context the
// patient needs to manage it (doctor, specialty, appointment type, their data).
// Response composites made of domain schemas live here alongside the domain
// schemas they are built from (see ARCHITECTURE.md §1.1).
export const appointmentDetailSchema = z.object({
  appointment: appointmentSchema,
  patient: patientSchema,
  doctor: doctorSchema,
  specialty: specialtySchema,
  appointmentType: appointmentTypeSchema,
});

export type AppointmentDetail = z.infer<typeof appointmentDetailSchema>;