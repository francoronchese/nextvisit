import { randomBytes } from "node:crypto";
import type { BookingResponse } from "@nextvisit/shared";
import { query, queryOne, withTransaction } from "../db/client";
import { createBookingQueries, type BookingQueries } from "../db/queries/bookings";
import type { BookingNotifier } from "../utils/email";
import { buildOneTimeLinkUrl, resendNotifier } from "../utils/email";
import { clinicLocalToUtc } from "../utils/clinicTimezone";
import { BookingRateLimitedError } from "../utils/bookingRateLimitedError";
import { NotFoundError } from "../utils/notFoundError";
import { SlotUnavailableError } from "../utils/slotUnavailableError";
import { TooManyAppointmentsError } from "../utils/tooManyAppointmentsError";
import { slotsService, type SlotsService } from "./slots";

export const MAX_ACTIVE_APPOINTMENTS = 3;
export const MAX_BOOKING_ATTEMPTS = 5;
export const BOOKING_ATTEMPT_WINDOW_MS = 60 * 60 * 1000;

export type BookAppointmentInput = {
  dni: string;
  firstName: string;
  lastName: string;
  healthInsuranceId: string;
  phone: string;
  email: string;
  doctorId: string;
  typeId: string;
  date: string;
  startTime: string;
};

export type BookingResult = BookingResponse;

export type BookingService = {
  book(input: BookAppointmentInput, options?: { now?: Date }): Promise<BookingResult>;
};

export type BookingServiceDeps = {
  queries: BookingQueries;
  availability: SlotsService;
  notifier: BookingNotifier;
};

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === "23505") return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && /duplicate key/.test(message);
}

// Rate limiting is deliberately outside the booking transaction: a rejected or
// failed attempt must still be recorded, so it runs on the pool before the tx
// starts and its INSERTs commit even when the booking later rolls back.
export async function enforceBookingRateLimit(
  queries: Pick<BookingQueries, "recordBookingAttempt" | "countRecentBookingAttempts">,
  dni: string,
  now: Date
): Promise<void> {
  await queries.recordBookingAttempt(dni);
  const since = new Date(now.getTime() - BOOKING_ATTEMPT_WINDOW_MS).toISOString();
  const attempts = await queries.countRecentBookingAttempts(dni, since);
  if (attempts > MAX_BOOKING_ATTEMPTS) {
    throw new BookingRateLimitedError();
  }
}

export function createBookingService(deps: BookingServiceDeps): BookingService {
  const { queries, availability, notifier } = deps;
  return {
    async book(input, options) {
      const now = options?.now ?? new Date();

      // Per-DNI serialization first (spec: cap enforced inside the booking
      // transaction): concurrent bookings for the same DNI queue here, so the
      // patient upsert and the cap count below never race each other.
      await queries.lockPatient(input.dni);

      const available = await availability.getAvailableSlot(
        input.doctorId,
        input.typeId,
        input.date,
        input.startTime,
        now
      );
      if (!available) {
        throw new SlotUnavailableError();
      }

      const insurance = await queries.getHealthInsuranceById(input.healthInsuranceId);
      if (!insurance) {
        throw new NotFoundError("health insurance");
      }

      const activeCount = await queries.countActiveAppointmentsForDni(input.dni);
      if (activeCount >= MAX_ACTIVE_APPOINTMENTS) {
        throw new TooManyAppointmentsError();
      }

      const patientFields = {
        firstName: input.firstName,
        lastName: input.lastName,
        healthInsuranceId: input.healthInsuranceId,
        phone: input.phone,
        email: input.email,
      };
      const existing = await queries.getPatientByDni(input.dni);
      const patient = existing
        ? await queries.updatePatient(existing.id, patientFields)
        : await queries.createPatient({ ...patientFields, dni: input.dni });

      const startsAt = clinicLocalToUtc(input.date, input.startTime).toISOString();
      let appointment;
      try {
        appointment = await queries.createAppointment({
          patientId: patient.id,
          doctorId: input.doctorId,
          appointmentTypeId: input.typeId,
          startsAt,
          durationMinutes: available.durationMinutes,
          bookingChannel: "web",
          copayAmount: insurance.copayAmount,
        });
      } catch (error) {
        // Two patients grabbing the same slot: the DB unique constraint on
        // (doctor_id, starts_at) rejects the second booking even under concurrency.
        if (isUniqueViolation(error)) {
          throw new SlotUnavailableError();
        }
        throw error;
      }

      const token = randomBytes(32).toString("hex");
      await queries.createOneTimeLink({
        appointmentId: appointment.id,
        token,
        expiresAt: startsAt,
      });

      // Email is best-effort: a transient Resend failure must not lose the booking.
      await notifier
        .sendConfirmationEmail({
          to: patient.email ?? "",
          patient,
          appointment,
          oneTimeLinkUrl: buildOneTimeLinkUrl(token),
        })
        .catch((error: unknown) => {
          console.error("failed to send confirmation email:", error);
        });

      return { patient, appointment };
    },
  };
}

const poolBookingQueries = createBookingQueries({ query, queryOne });

export const bookingService: BookingService = {
  async book(input, options) {
    const now = options?.now ?? new Date();
    await enforceBookingRateLimit(poolBookingQueries, input.dni, now);
    return withTransaction(async (tx) => {
      const queries = createBookingQueries(tx);
      return createBookingService({
        queries,
        availability: slotsService,
        notifier: resendNotifier,
      }).book(input, options);
    });
  },
};