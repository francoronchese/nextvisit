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
  resendNotifier,
  sendBestEffort,
  type CancellationEmailInput,
  type RescheduleConfirmationEmailInput,
} from "../utils/email";
import { cancellationWindowClosedError, notFoundError, slotUnavailableError } from "../utils/httpErrors";
import { isConstraintViolation } from "../utils/isConstraintViolation";
import { issueOneTimeLink } from "./oneTimeLink";
import { createSlotsService, type SlotsService } from "./slots";

// Online cancel/reschedule is allowed until 3h before the appointment (spec:
// cancellation window). After that only the secretary can change it.
export const CANCELLATION_WINDOW_MS = 3 * 60 * 60 * 1000;

export type RescheduleInput = {
  slot: ClinicLocalTime;
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
  // appointment end (expires_at is set to starts_at + duration at creation),
  // and a cancelled or ended appointment also invalidates the link.
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

// The cancellation core, shared by the online link flow and the secretary: frees
// the appointment (only a scheduled one cancels) and builds the notice email.
async function performCancel(
  deps: AppointmentManagementDeps,
  detail: AppointmentDetail
): Promise<CancelOutcome> {
  const cancelled = await deps.queries.cancelAppointment(detail.appointment.id);
  if (!cancelled) throw notFoundError("appointment");
  return {
    appointment: cancelled,
    email: {
      to: detail.patient.email ?? "",
      patient: detail.patient,
      appointment: cancelled,
    },
  };
}

// The reschedule core, shared by the online link flow and the secretary: one
// atomic transaction that frees the old slot and books the new one, keeping the
// patient, doctor, type, copay, and the channel it was booked through (spec:
// channels exist so the clinic knows how each patient books).
async function performReschedule(
  deps: AppointmentManagementDeps,
  detail: AppointmentDetail,
  input: RescheduleInput,
  now: Date
): Promise<RescheduleOutcome> {
  const old = detail.appointment;

  // 1. Free the old slot inside the transaction so a failed reschedule leaves
  //    the appointment exactly as it was.
  const cancelled = await deps.queries.cancelAppointment(old.id);
  if (!cancelled) throw notFoundError("appointment");

  // 2. The new slot must be open. The tx-scoped slots service sees the
  //    just-cancelled appointment, so rescheduling onto it works.
  const available = await deps.availability.getAvailableSlot(old.doctorId, old.appointmentTypeId, input.slot, now);
  if (!available) throw slotUnavailableError();

  const startsAt = clinicLocalToUtc(input.slot).toISOString();
  let created;
  try {
    created = await deps.bookingQueries.createAppointment({
      patientId: old.patientId,
      doctorId: old.doctorId,
      appointmentTypeId: old.appointmentTypeId,
      startsAt,
      durationMinutes: available.durationMinutes,
      bookingChannel: old.bookingChannel,
      copayAmount: old.copayAmount,
    });
  } catch (error) {
    // Someone else grabbed the slot between the check and the insert.
    if (isConstraintViolation(error)) throw slotUnavailableError();
    throw error;
  }

  const { url } = await issueOneTimeLink(deps.bookingQueries, created, available.durationMinutes);

  return {
    appointment: created,
    email: {
      to: detail.patient.email ?? "",
      patient: detail.patient,
      appointment: created,
      oneTimeLinkUrl: url,
    },
  };
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
  const { queries } = deps;

  return {
    async cancel(token: string, now: Date): Promise<CancelOutcome> {
      const { link, detail } = await resolveValidLink(queries, token, now);
      assertWithinCancellationWindow(detail.appointment, now);

      const outcome = await performCancel(deps, detail);
      // Single-use (spec): burning the link happens in the same transaction, so
      // a failed cancel leaves it untouched.
      await queries.markOneTimeLinkUsed(link.id);
      return outcome;
    },

    async reschedule(token: string, input: RescheduleInput, now: Date): Promise<RescheduleOutcome> {
      const { link, detail } = await resolveValidLink(queries, token, now);
      assertWithinCancellationWindow(detail.appointment, now);

      const outcome = await performReschedule(deps, detail, input, now);
      // Burn the old link when the new appointment is booked, inside the same
      // transaction (spec: a failed reschedule leaves everything as it was).
      await queries.markOneTimeLinkUsed(link.id);
      return outcome;
    },
  };
}

// The secretary reaches appointments by id, not by one-time link, and is not
// bound by the patient's cancellation window (spec: after the window closes
// only the secretary can change the appointment).
export function createSecretaryAppointmentService(deps: AppointmentManagementDeps) {
  return {
    async cancel(id: string): Promise<CancelOutcome> {
      const detail = await deps.queries.getAppointmentDetail(id);
      if (!detail) throw notFoundError("appointment");
      return performCancel(deps, detail);
    },

    async reschedule(id: string, input: RescheduleInput, now: Date): Promise<RescheduleOutcome> {
      const detail = await deps.queries.getAppointmentDetail(id);
      if (!detail) throw notFoundError("appointment");
      return performReschedule(deps, detail, input, now);
    },
  };
}

const poolAppointmentQueries = createAppointmentManagementQueries({ query, queryOne });

export type AppointmentManagementService = {
  getByToken(token: string, options?: { now?: Date }): Promise<AppointmentDetail>;
  cancel(token: string, options?: { now?: Date }): Promise<Appointment>;
  reschedule(token: string, input: RescheduleInput, options?: { now?: Date }): Promise<Appointment>;
};

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

export type SecretaryAppointmentService = {
  cancel(id: string): Promise<Appointment>;
  reschedule(id: string, input: RescheduleInput): Promise<Appointment>;
};

// Email is best-effort and sent only after the transaction commits, so a
// transient Resend failure can never roll back the appointment change.
export const secretaryAppointmentService: SecretaryAppointmentService = {
  async cancel(id) {
    const { appointment, email } = await withTransaction(async (tx) => {
      const queries = createAppointmentManagementQueries(tx);
      return createSecretaryAppointmentService({
        queries,
        bookingQueries: createBookingQueries(tx),
        availability: createSlotsService({ ...createSlotQueries(tx), getAppointmentTypeById }),
      }).cancel(id);
    });
    await sendBestEffort(() => resendNotifier.sendCancellationEmail(email));
    return appointment;
  },

  async reschedule(id, input) {
    const { appointment, email } = await withTransaction(async (tx) => {
      const queries = createAppointmentManagementQueries(tx);
      return createSecretaryAppointmentService({
        queries,
        bookingQueries: createBookingQueries(tx),
        availability: createSlotsService({ ...createSlotQueries(tx), getAppointmentTypeById }),
      }).reschedule(id, input, new Date());
    });
    await sendBestEffort(() => resendNotifier.sendRescheduleConfirmationEmail(email));
    return appointment;
  },
};