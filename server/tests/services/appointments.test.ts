import { describe, expect, it, vi } from "vitest";
import type {
  Appointment,
  AppointmentDetail,
  AppointmentType,
  Doctor,
  OneTimeLink,
  Patient,
  Specialty,
} from "@nextvisit/shared";
import {
  createAppointmentManagementService,
  getAppointmentByToken,
  type AppointmentManagementDeps,
  type RescheduleInput,
} from "../../src/services/appointments";
import type { AppointmentManagementQueries } from "../../src/db/queries/appointments";
import type { BookingQueries } from "../../src/db/queries/bookings";
import type { SlotsService } from "../../src/services/slots";

const token = "a".repeat(64);
const NOW = new Date("2026-11-20T10:00:00.000Z");
// 16:00 clinic-agnostic UTC is 6h after NOW, comfortably outside the 3h window.
const startsAt = "2026-11-20T16:00:00.000Z";

const patient: Patient = {
  id: "a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a17",
  dni: "30111222",
  firstName: "Ana",
  lastName: "Pérez",
  healthInsuranceId: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a1a",
  phone: "555-0101",
  email: "ana@example.com",
};

const doctor: Doctor = {
  id: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16",
  specialtyId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  firstName: "María",
  lastName: "González",
};

const specialty: Specialty = {
  id: doctor.specialtyId,
  name: "Cardiology",
};

const appointmentType: AppointmentType = {
  id: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
  specialtyId: doctor.specialtyId,
  name: "Cardiology consultation",
  durationMinutes: 30,
};

const appointment: Appointment = {
  id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18",
  patientId: patient.id,
  doctorId: doctor.id,
  appointmentTypeId: appointmentType.id,
  startsAt,
  durationMinutes: 30,
  bookingChannel: "web",
  status: "scheduled",
  attendance: "pending",
  copayAmount: 5000,
  copayPaid: false,
  createdAt: "2026-11-20T08:00:00.000Z",
};

const detail: AppointmentDetail = {
  appointment,
  patient,
  doctor,
  specialty,
  appointmentType,
};

const link: OneTimeLink = {
  id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a19",
  appointmentId: appointment.id,
  token,
  createdAt: "2026-11-20T08:00:00.000Z",
  expiresAt: startsAt,
};

function buildQueries(
  overrides: Partial<AppointmentManagementQueries> = {}
): AppointmentManagementQueries {
  return {
    getOneTimeLinkByToken: vi.fn(() => Promise.resolve(link)),
    getAppointmentById: vi.fn(() => Promise.resolve(appointment)),
    getAppointmentDetail: vi.fn(() => Promise.resolve(detail)),
    markOneTimeLinkUsed: vi.fn(() => Promise.resolve()),
    cancelAppointment: vi.fn(() =>
      Promise.resolve<Appointment>({ ...appointment, status: "cancelled" })
    ),
    ...overrides,
  };
}

function buildBookingQueries(
  overrides: Partial<Pick<BookingQueries, "createAppointment" | "createOneTimeLink">> = {}
): Pick<BookingQueries, "createAppointment" | "createOneTimeLink"> {
  return {
    createAppointment: vi.fn(() =>
      Promise.resolve({ ...appointment, id: "d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a1b", startsAt })
    ),
    createOneTimeLink: vi.fn(() =>
      Promise.resolve({
        id: "d2eebc99-9c0b-4ef8-bb6d-6bb9bd380a1c",
        appointmentId: appointment.id,
        token: "b".repeat(64),
        createdAt: NOW.toISOString(),
        expiresAt: startsAt,
      } satisfies OneTimeLink)
    ),
    ...overrides,
  };
}

function buildAvailability(available = true): SlotsService {
  return {
    getSlotsForDoctor: vi.fn(() => Promise.resolve([])),
    getAvailableSlot: vi.fn(() =>
      available ? Promise.resolve({ slot: { date: "2026-11-27", startTime: "10:00", endTime: "10:30", available: true }, durationMinutes: 30 }) : Promise.resolve(undefined)
    ),
  };
}

function buildService(
  queries: AppointmentManagementQueries = buildQueries(),
  bookingQueries: Pick<BookingQueries, "createAppointment" | "createOneTimeLink"> = buildBookingQueries(),
  availability: SlotsService = buildAvailability()
): ReturnType<typeof createAppointmentManagementService> {
  const deps: AppointmentManagementDeps = { queries, bookingQueries, availability };
  return createAppointmentManagementService(deps);
}

describe("appointment management service", () => {
  it("resolves a valid link to the appointment detail", async () => {
    const queries = buildQueries();
    await expect(getAppointmentByToken(queries, token, NOW)).resolves.toEqual(detail);
    expect(queries.getOneTimeLinkByToken).toHaveBeenCalledWith(token);
  });

  it("rejects a link that has already been used (single-use)", async () => {
    const queries = buildQueries({
      getOneTimeLinkByToken: vi.fn(() =>
        Promise.resolve({ ...link, usedAt: "2026-11-20T09:00:00.000Z" })
      ),
    });
    await expect(getAppointmentByToken(queries, token, NOW)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("rejects an expired link", async () => {
    const queries = buildQueries({
      getOneTimeLinkByToken: vi.fn(() =>
        Promise.resolve({ ...link, expiresAt: "2026-11-19T16:00:00.000Z" })
      ),
    });
    await expect(getAppointmentByToken(queries, token, NOW)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("rejects a link whose appointment is no longer scheduled", async () => {
    const queries = buildQueries({
      getAppointmentById: vi.fn(() =>
        Promise.resolve<Appointment>({ ...appointment, status: "cancelled" })
      ),
    });
    await expect(getAppointmentByToken(queries, token, NOW)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("cancels the appointment, burns the link, and returns the cancellation email", async () => {
    const queries = buildQueries();
    const service = buildService(queries);

    const outcome = await service.cancel(token, NOW);

    expect(outcome.appointment.status).toBe("cancelled");
    expect(outcome.email.to).toBe(patient.email);
    expect(outcome.email.patient).toEqual(patient);
    expect(queries.cancelAppointment).toHaveBeenCalledWith(appointment.id);
    expect(queries.markOneTimeLinkUsed).toHaveBeenCalledWith(link.id);
  });

  it("rejects cancellation once the 3h window has closed", async () => {
    const closeAppointment = {
      ...appointment,
      startsAt: "2026-11-20T11:00:00.000Z",
    };
    const queries = buildQueries({
      getAppointmentDetail: vi.fn(() => Promise.resolve({ ...detail, appointment: closeAppointment })),
    });

    await expect(buildService(queries).cancel(token, NOW)).rejects.toMatchObject({ status: 409 });
    expect(queries.cancelAppointment).not.toHaveBeenCalled();
  });

  it("rejects when the cancel lost the race to another request on the same link", async () => {
    const queries = buildQueries({
      cancelAppointment: vi.fn(() => Promise.resolve(undefined)),
    });
    await expect(buildService(queries).cancel(token, NOW)).rejects.toMatchObject({ status: 404 });
  });

  it("reschedules onto an available slot, frees the old one, and issues a fresh link", async () => {
    const queries = buildQueries();
    const bookingQueries = buildBookingQueries();
    const input: RescheduleInput = { date: "2026-11-27", startTime: "10:00" };
    const service = buildService(queries, bookingQueries);

    const outcome = await service.reschedule(token, input, NOW);

    expect(queries.cancelAppointment).toHaveBeenCalledWith(appointment.id);
    expect(queries.markOneTimeLinkUsed).toHaveBeenCalledWith(link.id);
    expect(bookingQueries.createAppointment).toHaveBeenCalledWith({
      patientId: patient.id,
      doctorId: doctor.id,
      appointmentTypeId: appointmentType.id,
      startsAt: "2026-11-27T13:00:00.000Z",
      durationMinutes: 30,
      bookingChannel: "web",
      copayAmount: appointment.copayAmount,
    });
    const newToken = (bookingQueries.createOneTimeLink as ReturnType<typeof vi.fn>).mock.calls[0]![0]
      .token as string;
    expect(newToken).toMatch(/^[0-9a-f]{64}$/);
    expect(newToken).not.toBe(token);
    expect(outcome.email.oneTimeLinkUrl).toContain(`/appointments/${newToken}`);
  });

  it("rejects rescheduling when the new slot is already taken", async () => {
    const service = buildService(buildQueries(), buildBookingQueries(), buildAvailability(false));
    await expect(
      service.reschedule(token, { date: "2026-11-27", startTime: "10:00" }, NOW)
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects rescheduling when someone else grabs the slot between check and insert", async () => {
    const bookingQueries = buildBookingQueries({
      createAppointment: vi.fn(() =>
        Promise.reject(Object.assign(new Error("conflicting key"), { code: "23P01" }))
      ),
    });
    const service = buildService(buildQueries(), bookingQueries);

    await expect(
      service.reschedule(token, { date: "2026-11-27", startTime: "10:00" }, NOW)
    ).rejects.toMatchObject({ status: 409 });
    expect(bookingQueries.createOneTimeLink).not.toHaveBeenCalled();
  });

  it("rejects rescheduling once the 3h window has closed", async () => {
    const closeAppointment = {
      ...appointment,
      startsAt: "2026-11-20T11:00:00.000Z",
    };
    const queries = buildQueries({
      getAppointmentDetail: vi.fn(() => Promise.resolve({ ...detail, appointment: closeAppointment })),
    });

    await expect(
      buildService(queries).reschedule(token, { date: "2026-11-27", startTime: "10:00" }, NOW)
    ).rejects.toMatchObject({ status: 409 });
  });
});