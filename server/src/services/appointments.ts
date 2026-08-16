import { randomBytes } from "node:crypto";
import type { Appointment, AppointmentDetail, ClinicLocalTime } from "@nextvisit/shared";
import { clinicLocalToUtc } from "@nextvisit/shared";
import { query, queryOne, withTransaction } from "../db/client";
import {
  createAppointmentManagementQueries,
  type AppointmentManagementQueries,
} from "../db/queries/appointments";
import { createBookingQueries, type BookingQueries } from "../db/queries/bookings";
import { createSlotQueries } from "../db/queries/slots";
import { getAppointmentTypeById } from "../db/queries/catalog";
import {
  buildOneTimeLinkUrl,
  resendNotifier,
  type CancellationEmailInput,
  type RescheduleConfirmationEmailInput,
} from "../utils/email";
import { cancellationWindowClosedError, notFoundError, slotUnavailableError } from "../utils/httpErrors";
import { isConstraintViolation } from "../utils/isConstraintViolation";
import { createSlotsService, type SlotsService } from "./slots";

// Online cancel/reschedule is allowed until 3h before the appointment (spec:
// cancellation window). After that only the secretary can change it.
export const CANCELLATION_WINDOW_MS = 3 * 60 * 60 * 1000;

export type RescheduleInput = {
  date: string;
  startTime: string;
};

export type AppointmentManagementDeps = {
  queries: AppointmentManagementQueries;
  bookingQueries: Pick<BookingQueries, "createAppointment" | "createOneTimeLink">;
  availability: SlotsService;
};

export type CancelOutcome = {
  appointment: Appointment;
  email: CancellationEmailInput;
};

export type RescheduleOutcome = {
  appointment: Appointment;
  email: RescheduleConfirmationEmailInput;
};

async function resolveValidLink(
  queries: AppointmentManagementQueries,
  token: string,
  now: Date
): Promise<{ link: NonNullable<Awaited<ReturnType<AppointmentManagementQueries["getOneTimeLinkByToken"]>>>; detail: AppointmentDetail }> {
  const link = await queries.getOneTimeLinkByToken(token);
  if (!link) throw notFoundError("appointment link");
  // Single-use (spec): a used or expired link stops working. Expiry equals the
  // appointment start (expires_at is set to starts_at at creation), and a
  // cancelled or ended appointment also invalidates the link.
  if (link.usedAt) throw notFoundError("appointment link");
  if (now.getTime() >= new Date(link.expiresAt).getTime()) throw notFoundError("appointment link");

  const appointment = await queries.getAppointmentById(link.appointmentId);
  if (!appointment || appointment.status !== "scheduled") throw notFoundError("appointment link");

  const detail = await queries.getAppointmentDetail(appointment.id);
  if (!detail) throw notFoundError("appointment");
  return { link, detail };
}

function assertWithinCancellationWindow(appointment: Appointment, now: Date): void {
  const cutoffMs = new Date(appointment.startsAt).getTime() - CANCELLATION_WINDOW_MS;
  if (now.getTime() > cutoffMs) {
    throw cancellationWindowClosedError();
  }
}

export async function getAppointmentByToken(
  queries: AppointmentManagementQueries,
  token: string,
  now: Date
): Promise<AppointmentDetail> {
  const { detail } = await resolveValidLink(queries, token, now);
  return detail;
}

export function createAppointmentManagementService(deps: AppointmentManagementDeps) {
  const { queries, bookingQueries, availability } = deps;

  return {
    async cancel(token: string, now: Date): Promise<CancelOutcome> {
      const { link, detail } = await resolveValidLink(queries, token, now);
      assertWithinCancellationWindow(detail.appointment, now);

      const cancelled = await queries.cancelAppointment(detail.appointment.id);
      // Lost the race to another request using the same link.
      if (!cancelled) throw notFoundError("appointment link");
      await queries.markOneTimeLinkUsed(link.id);

      return {
        appointment: cancelled,
        email: {
          to: detail.patient.email ?? "",
          patient: detail.patient,
          appointment: cancelled,
        },
      };
    },

    async reschedule(token: string, input: RescheduleInput, now: Date): Promise<RescheduleOutcome> {
      const { link, detail } = await resolveValidLink(queries, token, now);
      assertWithinCancellationWindow(detail.appointment, now);
      const old = detail.appointment;
      const slot = { date: input.date, time: input.startTime } satisfies ClinicLocalTime;

      // 1. Free the old slot and burn the link inside the transaction so a
      //    failed reschedule leaves the appointment exactly as it was.
      const cancelled = await queries.cancelAppointment(old.id);
      if (!cancelled) throw notFoundError("appointment link");
      await queries.markOneTimeLinkUsed(link.id);

      // 2. The new slot must be open. The tx-scoped slots service sees the
      //    just-cancelled appointment, so rescheduling onto it works.
      const available = await availability.getAvailableSlot(old.doctorId, old.appointmentTypeId, slot, now);
      if (!available) throw slotUnavailableError();

      const startsAt = clinicLocalToUtc(slot).toISOString();
      let created;
      try {
        created = await bookingQueries.createAppointment({
          patientId: old.patientId,
          doctorId: old.doctorId,
          appointmentTypeId: old.appointmentTypeId,
          startsAt,
          durationMinutes: available.durationMinutes,
          bookingChannel: "web",
          copayAmount: old.copayAmount,
        });
      } catch (error) {
        // Someone else grabbed the slot between the check and the insert.
        if (isConstraintViolation(error)) throw slotUnavailableError();
        throw error;
      }

      const newToken = randomBytes(32).toString("hex");
      await bookingQueries.createOneTimeLink({
        appointmentId: created.id,
        token: newToken,
        expiresAt: startsAt,
      });

      return {
        appointment: created,
        email: {
          to: detail.patient.email ?? "",
          patient: detail.patient,
          appointment: created,
          oneTimeLinkUrl: buildOneTimeLinkUrl(newToken),
        },
      };
    },
  };
}

const poolAppointmentQueries = createAppointmentManagementQueries({ query, queryOne });

export type AppointmentManagementService = {
  getByToken(token: string, options?: { now?: Date }): Promise<AppointmentDetail>;
  cancel(token: string, options?: { now?: Date }): Promise<Appointment>;
  reschedule(token: string, input: RescheduleInput, options?: { now?: Date }): Promise<Appointment>;
};

async function sendBestEffort(action: () => Promise<void>): Promise<void> {
  await action().catch((error: unknown) => {
    console.error("failed to send appointment email:", error);
  });
}

export const appointmentManagementService: AppointmentManagementService = {
  async getByToken(token, options) {
    const now = options?.now ?? new Date();
    return getAppointmentByToken(poolAppointmentQueries, token, now);
  },

  async cancel(token, options) {
    const now = options?.now ?? new Date();
    const { appointment, email } = await withTransaction(async (tx) => {
      const queries = createAppointmentManagementQueries(tx);
      return createAppointmentManagementService({
        queries,
        bookingQueries: createBookingQueries(tx),
        availability: createSlotsService({ ...createSlotQueries(tx), getAppointmentTypeById }),
      }).cancel(token, now);
    });
    await sendBestEffort(() => resendNotifier.sendCancellationEmail(email));
    return appointment;
  },

  async reschedule(token, input, options) {
    const now = options?.now ?? new Date();
    const { appointment, email } = await withTransaction(async (tx) => {
      const queries = createAppointmentManagementQueries(tx);
      return createAppointmentManagementService({
        queries,
        bookingQueries: createBookingQueries(tx),
        availability: createSlotsService({ ...createSlotQueries(tx), getAppointmentTypeById }),
      }).reschedule(token, input, now);
    });
    await sendBestEffort(() => resendNotifier.sendRescheduleConfirmationEmail(email));
    return appointment;
  },
};