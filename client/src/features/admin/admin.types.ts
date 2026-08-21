import type {
  BlockReason,
  BookingChannel,
  BookingResponse,
  LoginResponse,
  StaffRole,
  User,
  Weekday,
} from "@nextvisit/shared";

export type {
  AppointmentDetailWithInsurance,
  AppointmentType,
  Availability,
  AvailabilityBlock,
  BlockReason,
  Doctor,
  DoctorAppointment,
  HealthInsurance,
  LoginResponse,
  Slot,
  Specialty,
  StaffRole,
  User,
  Weekday,
} from "@nextvisit/shared";

export type LoginCredentials = {
  email: string;
  password: string;
};

export type CreateUserPayload = {
  email: string;
  password: string;
  role: StaffRole;
  doctorId?: string;
};

export type HealthInsuranceInput = {
  name: string;
  copayAmount: number;
};

export type AvailabilityInput = {
  doctorId: string;
  weekday: Weekday;
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