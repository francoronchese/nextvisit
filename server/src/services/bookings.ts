import { randomBytes } from "node:crypto";
import type { BookingChannel, BookingResponse, ClinicLocalTime } from "@nextvisit/shared";
import { query, queryOne, withTransaction } from "../db/client";
import { createBookingQueries, type BookingQueries } from "../db/queries/bookings";
import { buildOneTimeLinkUrl, resendNotifier, sendBestEffort, type ConfirmationEmailInput } from "../utils/email";
import { clinicLocalToUtc } from "@nextvisit/shared";
import { bookingRateLimitedError, notFoundError, slotUnavailableError, tooManyAppointmentsError } from "../utils/httpErrors";
import { isConstraintViolation } from "../utils/isConstraintViolation";
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
  // Email is required on web bookings and optional when the secretary books on
  // behalf (CONTEXT.md: Booking Channel); the confirmation email goes out only
  // when the patient gave one.
  email?: string;
  doctorId: string;
  typeId: string;
  date: string;
  startTime: string;
  // Web bookings are always "web"; the secretary passes "front_desk" or "phone".
  bookingChannel?: BookingChannel;
};

export type BookingResult = BookingResponse;

// The core service produces the outcome plus the email it implies; the caller
// (the pool wrapper) sends the email only after the transaction commits so a
// Resend call never holds the booking transaction open.
export type BookingOutcome = {
  result: BookingResult;
  confirmationEmail: ConfirmationEmailInput;
};

export type BookingServiceCore = {
  book(input: BookAppointmentInput, options?: { now?: Date }): Promise<BookingOutcome>;
};

export type BookingService = {
  book(input: BookAppointmentInput, options?: { now?: Date }): Promise<BookingResult>;
};

export type BookingServiceDeps = {
  queries: BookingQueries;
  availability: SlotsService;
};

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
    throw bookingRateLimitedError();
  }
}

export function createBookingService(deps: BookingServiceDeps): BookingServiceCore {
  const { queries, availability } = deps;
  return {
    async book(input, options) {
      const now = options?.now ?? new Date();
      const slot = { date: input.date, time: input.startTime } satisfies ClinicLocalTime;

      // Per-DNI serialization first (spec: cap enforced inside the booking
      // transaction): concurrent bookings for the same DNI queue here, so the
      // patient upsert and the cap count below never race each other.
      await queries.lockPatient(input.dni);

      // Fast path over committed data; the DB constraint below is the authority
      // under concurrency, so this check may legitimately go stale.
      const available = await availability.getAvailableSlot(input.doctorId, input.typeId, slot, now);
      if (!available) {
        throw slotUnavailableError();
      }

      const insurance = await queries.getHealthInsuranceById(input.healthInsuranceId);
      if (!insurance) {
        throw notFoundError("health insurance");
      }

      const activeCount = await queries.countActiveAppointmentsForDni(input.dni);
      if (activeCount >= MAX_ACTIVE_APPOINTMENTS) {
        throw tooManyAppointmentsError();
      }

      const existing = await queries.getPatientByDni(input.dni);
      const patientFields = {
        firstName: input.firstName,
        lastName: input.lastName,
        healthInsuranceId: input.healthInsuranceId,
        phone: input.phone,
        // A secretary booking without an email must not wipe the patient's
        // stored one (spec: emails go out whenever the patient provided an
        // email, regardless of channel). New patients simply have no email.
        email: input.email ?? existing?.email ?? undefined,
      };
      const patient = existing
        ? await queries.updatePatient(existing.id, patientFields)
        : await queries.createPatient({ ...patientFields, dni: input.dni });

      const startsAt = clinicLocalToUtc(slot).toISOString();
      let appointment;
      try {
        appointment = await queries.createAppointment({
          patientId: patient.id,
          doctorId: input.doctorId,
          appointmentTypeId: input.typeId,
          startsAt,
          durationMinutes: available.durationMinutes,
          bookingChannel: input.bookingChannel ?? "web",
          copayAmount: insurance.copayAmount,
        });
      } catch (error) {
        // Two patients grabbing the same (or an overlapping) slot: the DB
        // constraints reject the second booking even under concurrency.
        if (isConstraintViolation(error)) {
          throw slotUnavailableError();
        }
        throw error;
      }

      const token = randomBytes(32).toString("hex");
      // The link dies when the appointment ends, not when it starts, so the
      // patient can still manage the booking right up to the last minute.
      const expiresAt = new Date(
        new Date(appointment.startsAt).getTime() + available.durationMinutes * 60_000
      ).toISOString();
      await queries.createOneTimeLink({
        appointmentId: appointment.id,
        token,
        expiresAt,
      });

      return {
        result: { patient, appointment },
        confirmationEmail: {
          to: patient.email ?? "",
          patient,
          appointment,
          oneTimeLinkUrl: buildOneTimeLinkUrl(token),
        },
      };
    },
  };
}

const poolBookingQueries = createBookingQueries({ query, queryOne });

export const bookingService: BookingService = {
  async book(input, options) {
    const now = options?.now ?? new Date();
    await enforceBookingRateLimit(poolBookingQueries, input.dni, now);
    const outcome = await withTransaction(async (tx) => {
      const queries = createBookingQueries(tx);
      return createBookingService({
        queries,
        availability: slotsService,
      }).book(input, options);
    });

    // Email is best-effort: a transient Resend failure must not lose the booking.
    await sendBestEffort(() => resendNotifier.sendConfirmationEmail(outcome.confirmationEmail));

    return outcome.result;
  },
};