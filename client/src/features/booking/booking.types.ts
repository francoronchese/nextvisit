export type {
  Appointment,
  AppointmentType,
  BookingResponse as BookingResult,
  Doctor,
  HealthInsurance,
  OneTimeLink,
  Patient,
  Slot,
  Specialty,
} from "@nextvisit/shared";

export type PatientFormData = {
  dni: string;
  firstName: string;
  lastName: string;
  healthInsuranceId: string;
  phone: string;
  email: string;
};

export type BookingPayload = PatientFormData & {
  doctorId: string;
  typeId: string;
  date: string;
  startTime: string;
};