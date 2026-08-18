import type { BlockReason, BookingChannel, BookingResponse, User } from "@nextvisit/shared";

export type {
  AppointmentType,
  Availability,
  AvailabilityBlock,
  BlockReason,
  Doctor,
  HealthInsurance,
  Slot,
  Specialty,
} from "@nextvisit/shared";

export type LoginCredentials = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  user: User;
};

export type AvailabilityInput = {
  doctorId: string;
  weekday: number;
  startTime: string;
  endTime: string;
};

export type AvailabilityBlockInput = {
  doctorId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: BlockReason;
};

export type SecretaryChannel = Extract<BookingChannel, "front_desk" | "phone">;

export type SecretaryPatientData = {
  dni: string;
  firstName: string;
  lastName: string;
  healthInsuranceId: string;
  phone: string;
  email: string;
};

export type SecretaryBookingPayload = Omit<SecretaryPatientData, "email"> & {
  email?: string;
  doctorId: string;
  typeId: string;
  date: string;
  startTime: string;
  bookingChannel: SecretaryChannel;
};

export type { BookingResponse as SecretaryBookingResult } from "@nextvisit/shared";