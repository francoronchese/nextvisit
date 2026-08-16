import type { BlockReason, User } from "@nextvisit/shared";

export type { Availability, AvailabilityBlock, BlockReason, Doctor } from "@nextvisit/shared";

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