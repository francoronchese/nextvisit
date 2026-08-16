export type {
  Appointment,
  AppointmentDetail,
  AppointmentType,
  Doctor,
  Patient,
  Specialty,
} from "@nextvisit/shared";

export type ReschedulePayload = {
  date: string;
  startTime: string;
};