import { describe, expect, it, vi } from "vitest";
import type { Appointment, HealthInsurance, OneTimeLink, Patient, Slot } from "@nextvisit/shared";
import type { BookingNotifier } from "../../src/utils/email";
import {
  BOOKING_ATTEMPT_WINDOW_MS,
  createBookingService,
  enforceBookingRateLimit,
  MAX_ACTIVE_APPOINTMENTS,
  MAX_BOOKING_ATTEMPTS,
  type BookingService,
  type BookAppointmentInput,
} from "../../src/services/bookings";
import type { SlotsService } from "../../src/services/slots";
import type { BookingQueries, PatientInput } from "../../src/db/queries/bookings";
import { BookingRateLimitedError } from "../../src/utils/bookingRateLimitedError";
import { NotFoundError } from "../../src/utils/notFoundError";
import { SlotUnavailableError } from "../../src/utils/slotUnavailableError";
import { TooManyAppointmentsError } from "../../src/utils/tooManyAppointmentsError";

const DNI = "30111222";
const doctorId = "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16";
const typeId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13";
const insuranceId = "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a1a";

const insurance: HealthInsurance = {
  id: insuranceId,
  name: "IOMA",
  copayAmount: 5000,
};

const patientInput = {
  dni: DNI,
  firstName: "Ana",
  lastName: "Pérez",
  healthInsuranceId: insuranceId,
  phone: "555-0101",
  email: "ana@example.com",
};

const existingPatient: Patient = {
  id: "a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a17",
  ...patientInput,
};

const appointment: Appointment = {
  id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18",
  patientId: existingPatient.id,
  doctorId,
  appointmentTypeId: typeId,
  startsAt: "2026-09-07T12:00:00.000Z",
  durationMinutes: 30,
  bookingChannel: "web",
  status: "scheduled",
  attendance: "pending",
  copayAmount: 5000,
  copayPaid: false,
  createdAt: "2026-09-07T08:00:00.000Z",
};

const oneTimeLink: OneTimeLink = {
  id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a19",
  appointmentId: appointment.id,
  token: "0".repeat(64),
  createdAt: "2026-09-07T08:00:00.000Z",
  expiresAt: appointment.startsAt,
};

const availableSlot: Slot = {
  date: "2026-09-07",
  startTime: "09:00",
  endTime: "09:30",
  available: true,
};

const bookingInput: BookAppointmentInput = {
  ...patientInput,
  doctorId,
  typeId,
  date: availableSlot.date,
  startTime: availableSlot.startTime,
};

function buildAvailability(): SlotsService {
  return {
    getSlotsForDoctor: vi.fn(() => Promise.resolve([availableSlot])),
    getAvailableSlot: vi.fn(() =>
      Promise.resolve({ slot: availableSlot, durationMinutes: 30 })
    ),
  };
}

function buildNotifier(): BookingNotifier & { sendConfirmationEmail: ReturnType<typeof vi.fn> } {
  return {
    sendConfirmationEmail: vi.fn(() => Promise.resolve()),
  };
}

function buildQueries(overrides: Partial<BookingQueries> = {}): BookingQueries {
  return {
    lockPatient: vi.fn(() => Promise.resolve()),
    countActiveAppointmentsForDni: vi.fn(() => Promise.resolve(0)),
    getHealthInsuranceById: vi.fn((id: string) =>
      Promise.resolve(id === insuranceId ? insurance : undefined)
    ),
    getPatientByDni: vi.fn(() => Promise.resolve(undefined)),
    createPatient: vi.fn((input: PatientInput) =>
      Promise.resolve({ id: existingPatient.id, ...input })
    ),
    updatePatient: vi.fn((id: string, input: Omit<PatientInput, "dni">) =>
      Promise.resolve({ id, dni: DNI, ...input })
    ),
    createAppointment: vi.fn(() => Promise.resolve(appointment)),
    createOneTimeLink: vi.fn(() => Promise.resolve(oneTimeLink)),
    recordBookingAttempt: vi.fn(() => Promise.resolve()),
    countRecentBookingAttempts: vi.fn(() => Promise.resolve(0)),
    ...overrides,
  };
}

function buildService(
  queries: BookingQueries,
  notifier: BookingNotifier,
  availability: SlotsService = buildAvailability()
): BookingService {
  return createBookingService({ queries, availability, notifier });
}

const NOW = new Date("2026-09-07T08:00:00.000Z");

describe("booking service", () => {
  it("books an appointment for a new patient, creating patient, appointment and one-time link", async () => {
    const queries = buildQueries();
    const notifier = buildNotifier();
    const service = buildService(queries, notifier);

    const result = await service.book(bookingInput, { now: NOW });

    expect(result).toEqual({ patient: { id: existingPatient.id, ...patientInput }, appointment });

    expect(queries.lockPatient).toHaveBeenCalledWith(DNI);
    expect(queries.createPatient).toHaveBeenCalledWith(patientInput);
    expect(queries.updatePatient).not.toHaveBeenCalled();
    expect(queries.createAppointment).toHaveBeenCalledWith({
      patientId: existingPatient.id,
      doctorId,
      appointmentTypeId: typeId,
      startsAt: "2026-09-07T12:00:00.000Z",
      durationMinutes: 30,
      bookingChannel: "web",
      copayAmount: insurance.copayAmount,
    });
    expect(queries.createOneTimeLink).toHaveBeenCalledWith({
      appointmentId: appointment.id,
      token: expect.stringMatching(/^[0-9a-f]{64}$/),
      expiresAt: appointment.startsAt,
    });
  });

  it("takes the per-DNI lock before counting active appointments so the cap can't race", async () => {
    const queries = buildQueries();
    const service = buildService(queries, buildNotifier());

    await service.book(bookingInput, { now: NOW });

    const lockCall = (queries.lockPatient as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!;
    const countCall =
      (queries.countActiveAppointmentsForDni as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!;
    const patientCall = (queries.createPatient as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!;
    expect(lockCall).toBeLessThan(countCall);
    expect(lockCall).toBeLessThan(patientCall);
  });

  it("records every attempt and rejects once attempts exceed the per-DNI window limit", async () => {
    const queries = buildQueries({
      countRecentBookingAttempts: vi.fn(() => Promise.resolve(MAX_BOOKING_ATTEMPTS + 1)),
    });

    await expect(enforceBookingRateLimit(queries, DNI, NOW)).rejects.toBeInstanceOf(
      BookingRateLimitedError
    );
    expect(queries.recordBookingAttempt).toHaveBeenCalledWith(DNI);
    expect(queries.countRecentBookingAttempts).toHaveBeenCalledWith(
      DNI,
      new Date(NOW.getTime() - BOOKING_ATTEMPT_WINDOW_MS).toISOString()
    );
  });

  it("allows an attempt within the window limit", async () => {
    const queries = buildQueries({
      countRecentBookingAttempts: vi.fn(() => Promise.resolve(MAX_BOOKING_ATTEMPTS - 1)),
    });

    await expect(enforceBookingRateLimit(queries, DNI, NOW)).resolves.toBeUndefined();
  });

  it("updates the existing patient when the DNI already exists", async () => {
    const queries = buildQueries({
      getPatientByDni: vi.fn(() => Promise.resolve(existingPatient)),
    });
    const service = buildService(queries, buildNotifier());

    await service.book(bookingInput, { now: NOW });

    expect(queries.createPatient).not.toHaveBeenCalled();
    expect(queries.updatePatient).toHaveBeenCalledWith(existingPatient.id, {
      firstName: patientInput.firstName,
      lastName: patientInput.lastName,
      healthInsuranceId: patientInput.healthInsuranceId,
      phone: patientInput.phone,
      email: patientInput.email,
    });
  });

  it("sends a confirmation email with the one-time link to the patient", async () => {
    const notifier = buildNotifier();
    const service = buildService(buildQueries(), notifier);

    await service.book(bookingInput, { now: NOW });

    expect(notifier.sendConfirmationEmail).toHaveBeenCalledTimes(1);
    const call = notifier.sendConfirmationEmail.mock.calls[0]![0];
    expect(call.to).toBe(patientInput.email);
    expect(call.patient).toEqual({ id: existingPatient.id, ...patientInput });
    expect(call.oneTimeLinkUrl).toContain("/appointments/");
  });

  it("rejects a booking once the patient already has 3 active future appointments", async () => {
    const queries = buildQueries({
      countActiveAppointmentsForDni: vi.fn(() => Promise.resolve(MAX_ACTIVE_APPOINTMENTS)),
    });
    const service = buildService(queries, buildNotifier());

    await expect(service.book(bookingInput, { now: NOW })).rejects.toBeInstanceOf(
      TooManyAppointmentsError
    );
    expect(queries.createAppointment).not.toHaveBeenCalled();
  });

  it("allows a booking when the patient has fewer than 3 active future appointments", async () => {
    const queries = buildQueries({
      countActiveAppointmentsForDni: vi.fn(() => Promise.resolve(2)),
    });
    const service = buildService(queries, buildNotifier());

    await expect(service.book(bookingInput, { now: NOW })).resolves.toBeDefined();
  });

  it("rejects a booking for a slot that is no longer available", async () => {
    const queries = buildQueries();
    const availability: SlotsService = {
      getSlotsForDoctor: vi.fn(() => Promise.resolve([availableSlot])),
      getAvailableSlot: vi.fn(() => Promise.resolve(undefined)),
    };
    const service = buildService(queries, buildNotifier(), availability);

    await expect(service.book(bookingInput, { now: NOW })).rejects.toBeInstanceOf(
      SlotUnavailableError
    );
    expect(queries.createAppointment).not.toHaveBeenCalled();
  });

  it("rejects a booking when the slot was just taken by someone else", async () => {
    const queries = buildQueries({
      createAppointment: vi.fn(() =>
        Promise.reject(
          Object.assign(
            new Error("duplicate key value violates unique constraint appointments_doctor_starts_at_active_idx"),
            { code: "23505" }
          )
        )
      ),
    });
    const service = buildService(queries, buildNotifier());

    await expect(service.book(bookingInput, { now: NOW })).rejects.toBeInstanceOf(
      SlotUnavailableError
    );
    expect(queries.createOneTimeLink).not.toHaveBeenCalled();
  });

  it("rejects a booking with an unknown health insurance", async () => {
    const queries = buildQueries({
      getHealthInsuranceById: vi.fn(() => Promise.resolve(undefined)),
    });
    const service = buildService(queries, buildNotifier());

    await expect(service.book(bookingInput, { now: NOW })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});