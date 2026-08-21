import { describe, expect, it, vi } from "vitest";
import type { Appointment, HealthInsurance, OneTimeLink, Patient, Slot } from "@nextvisit/shared";
import {
  BOOKING_ATTEMPT_WINDOW_MS,
  createBookingService,
  enforceBookingRateLimit,
  MAX_ACTIVE_APPOINTMENTS,
  MAX_BOOKING_ATTEMPTS,
  type BookAppointmentInput,
  type BookingServiceCore,
} from "../../src/services/bookings";
import type { SlotsService } from "../../src/services/slots";
import type { BookingQueries, PatientInput } from "../../src/db/queries/bookings";

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
  slot: { date: availableSlot.date, time: availableSlot.startTime },
};

function buildAvailability(): SlotsService {
  return {
    getSlotsForDoctor: vi.fn(() => Promise.resolve([availableSlot])),
    getAvailableSlot: vi.fn(() =>
      Promise.resolve({ slot: availableSlot, durationMinutes: 30 })
    ),
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
      Promise.resolve({ id: existingPatient.id, ...input, email: input.email ?? null })
    ),
    updatePatient: vi.fn((id: string, input: Omit<PatientInput, "dni">) =>
      Promise.resolve({ id, dni: DNI, ...input, email: input.email ?? null })
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
  availability: SlotsService = buildAvailability()
): BookingServiceCore {
  return createBookingService({ queries, availability });
}

const NOW = new Date("2026-09-07T08:00:00.000Z");

describe("booking service", () => {
  it("books an appointment for a new patient, creating patient, appointment and one-time link", async () => {
    const queries = buildQueries();
    const service = buildService(queries);

    const outcome = await service.book(bookingInput, { now: NOW });

    expect(outcome.result).toEqual({ patient: { id: existingPatient.id, ...patientInput }, appointment });

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
      expiresAt: new Date(
        new Date(appointment.startsAt).getTime() + appointment.durationMinutes * 60_000
      ).toISOString(),
    });
  });

  it("takes the per-DNI lock before counting active appointments so the cap can't race", async () => {
    const queries = buildQueries();
    const service = buildService(queries);

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

    await expect(enforceBookingRateLimit(queries, DNI, NOW)).rejects.toMatchObject({
      status: 429,
      message: "too many booking attempts, please try again later",
    });
    expect(queries.recordBookingAttempt).toHaveBeenCalledWith(DNI);
    expect(queries.countRecentBookingAttempts).toHaveBeenCalledWith(
      DNI,
      new Date(NOW.getTime() - BOOKING_ATTEMPT_WINDOW_MS).toISOString()
    );
  });

  it("allows attempts at exactly the window limit", async () => {
    const queries = buildQueries({
      countRecentBookingAttempts: vi.fn(() => Promise.resolve(MAX_BOOKING_ATTEMPTS)),
    });

    await expect(enforceBookingRateLimit(queries, DNI, NOW)).resolves.toBeUndefined();
  });

  it("updates the existing patient when the DNI already exists", async () => {
    const queries = buildQueries({
      getPatientByDni: vi.fn(() => Promise.resolve(existingPatient)),
    });
    const service = buildService(queries);

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

  it("produces a confirmation email payload with the one-time link for the patient", async () => {
    const service = buildService(buildQueries());

    const { confirmationEmail } = await service.book(bookingInput, { now: NOW });

    expect(confirmationEmail.to).toBe(patientInput.email);
    expect(confirmationEmail.patient).toEqual({ id: existingPatient.id, ...patientInput });
    expect(confirmationEmail.appointment).toEqual(appointment);
    expect(confirmationEmail.oneTimeLinkUrl).toContain("/appointments/");
  });

  it("rejects a booking once the patient already has 3 active future appointments", async () => {
    const queries = buildQueries({
      countActiveAppointmentsForDni: vi.fn(() => Promise.resolve(MAX_ACTIVE_APPOINTMENTS)),
    });
    const service = buildService(queries);

    await expect(service.book(bookingInput, { now: NOW })).rejects.toMatchObject({
      status: 422,
      message: "you already have 3 future appointments",
    });
    expect(queries.createAppointment).not.toHaveBeenCalled();
  });

  it("allows a booking when the patient has fewer than 3 active future appointments", async () => {
    const queries = buildQueries({
      countActiveAppointmentsForDni: vi.fn(() => Promise.resolve(2)),
    });
    const service = buildService(queries);

    await expect(service.book(bookingInput, { now: NOW })).resolves.toBeDefined();
  });

  it("rejects a booking for a slot that is no longer available", async () => {
    const queries = buildQueries();
    const availability: SlotsService = {
      getSlotsForDoctor: vi.fn(() => Promise.resolve([availableSlot])),
      getAvailableSlot: vi.fn(() => Promise.resolve(undefined)),
    };
    const service = buildService(queries, availability);

    await expect(service.book(bookingInput, { now: NOW })).rejects.toMatchObject({ status: 409 });
    expect(queries.createAppointment).not.toHaveBeenCalled();
  });

  it("rejects a booking when the slot was just taken by someone else", async () => {
    const queries = buildQueries({
      createAppointment: vi.fn(() =>
        Promise.reject(
          Object.assign(
            new Error("conflicting key value violates exclusion constraint"),
            { code: "23P01" }
          )
        )
      ),
    });
    const service = buildService(queries);

    await expect(service.book(bookingInput, { now: NOW })).rejects.toMatchObject({ status: 409 });
    expect(queries.createOneTimeLink).not.toHaveBeenCalled();
  });

  it("rejects a booking with an unknown health insurance", async () => {
    const queries = buildQueries({
      getHealthInsuranceById: vi.fn(() => Promise.resolve(undefined)),
    });
    const service = buildService(queries);

    await expect(service.book(bookingInput, { now: NOW })).rejects.toMatchObject({ status: 404 });
  });
});

describe("booking service — secretary booking on behalf", () => {
  it("books through the front desk, recording the channel on the appointment", async () => {
    const queries = buildQueries();
    const service = buildService(queries);

    await service.book({ ...bookingInput, bookingChannel: "front_desk" }, { now: NOW });

    expect(queries.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ bookingChannel: "front_desk" })
    );
  });

  it("books by phone, recording the channel on the appointment", async () => {
    const queries = buildQueries();
    const service = buildService(queries);

    await service.book({ ...bookingInput, bookingChannel: "phone" }, { now: NOW });

    expect(queries.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ bookingChannel: "phone" })
    );
  });

  it("defaults to the web channel when none is given", async () => {
    const queries = buildQueries();
    const service = buildService(queries);

    await service.book(bookingInput, { now: NOW });

    expect(queries.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ bookingChannel: "web" })
    );
  });

  it("succeeds for a patient without an email and produces no email recipient", async () => {
    const queries = buildQueries();
    const service = buildService(queries);
    const noEmailInput = { ...bookingInput, email: undefined };

    const outcome = await service.book(noEmailInput, { now: NOW });

    expect(outcome.result.patient.email).toBeNull();
    expect(outcome.confirmationEmail.to).toBe("");
    expect(queries.createPatient).toHaveBeenCalledWith(
      expect.objectContaining({ email: undefined })
    );
  });

  it("sends the confirmation email when the front-desk patient provides one", async () => {
    const service = buildService(buildQueries());

    const outcome = await service.book(
      { ...bookingInput, bookingChannel: "front_desk" },
      { now: NOW }
    );

    expect(outcome.confirmationEmail.to).toBe(patientInput.email);
  });

  it("preserves a stored email but sends no confirmation when the booking gives none", async () => {
    const queries = buildQueries({
      getPatientByDni: vi.fn(() => Promise.resolve(existingPatient)),
    });
    const service = buildService(queries);

    const outcome = await service.book(
      { ...bookingInput, email: undefined, bookingChannel: "front_desk" },
      { now: NOW }
    );

    expect(queries.updatePatient).toHaveBeenCalledWith(existingPatient.id, {
      firstName: patientInput.firstName,
      lastName: patientInput.lastName,
      healthInsuranceId: patientInput.healthInsuranceId,
      phone: patientInput.phone,
      email: existingPatient.email,
    });
    expect(outcome.result.patient.email).toBe(existingPatient.email);
    expect(outcome.confirmationEmail.to).toBe("");
  });
});