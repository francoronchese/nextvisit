import { describe, expect, it } from "vitest";
import type { AppointmentType, Availability, AvailabilityBlock, Doctor, Slot } from "@nextvisit/shared";
import { createSlotsService, type BookedAppointment, type SlotQueries } from "../../src/services/slots";
import { NotFoundError } from "../../src/utils/notFoundError";

const cardioId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const maria: Doctor = {
  id: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16",
  specialtyId: cardioId,
  firstName: "María",
  lastName: "González",
};

const consulta: AppointmentType = {
  id: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
  specialtyId: cardioId,
  name: "Cardiology consultation",
  durationMinutes: 30,
};
const ecocardiograma: AppointmentType = {
  id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14",
  specialtyId: cardioId,
  name: "Echocardiogram",
  durationMinutes: 45,
};

const mondayAvailability: Availability = {
  id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18",
  doctorId: maria.id,
  weekday: 1,
  startTime: "09:00",
  endTime: "13:00",
};

// 2026-08-17 is a Monday.
const MONDAY = "2026-08-17";
// 11:00 clinic local (UTC-3) is 14:00 UTC.
const MONDAY_11AM_UTC = "2026-08-17T14:00:00.000Z";
const NOW_BEFORE_RANGE = new Date("2026-08-17T08:00:00.000Z");

function buildFakeQueries(overrides: Partial<SlotQueries> = {}): SlotQueries {
  return {
    getDoctorById: (id) => Promise.resolve(id === maria.id ? maria : undefined),
    getAppointmentTypeById: (id) =>
      Promise.resolve([consulta, ecocardiograma].find((t) => t.id === id)),
    getDoctorOffersType: (doctorId, typeId) =>
      Promise.resolve(doctorId === maria.id && (typeId === consulta.id || typeId === ecocardiograma.id)),
    listAvailabilityForDoctor: () => Promise.resolve([mondayAvailability]),
    listAvailabilityBlocksForDoctor: () => Promise.resolve([]),
    listBookedAppointmentsForDoctor: () => Promise.resolve([]),
    ...overrides,
  };
}

function slot(date: string, startTime: string, endTime: string, available: boolean): Slot {
  return { date, startTime, endTime, available };
}

describe("slots service", () => {
  it("computes available slots for a doctor's weekly availability, stepping by the type duration", async () => {
    const service = createSlotsService(buildFakeQueries());
    const slots = await service.getSlotsForDoctor(maria.id, consulta.id, MONDAY, {
      rangeDays: 1,
      now: NOW_BEFORE_RANGE,
    });
    expect(slots).toEqual([
      slot(MONDAY, "09:00", "09:30", true),
      slot(MONDAY, "09:30", "10:00", true),
      slot(MONDAY, "10:00", "10:30", true),
      slot(MONDAY, "10:30", "11:00", true),
      slot(MONDAY, "11:00", "11:30", true),
      slot(MONDAY, "11:30", "12:00", true),
      slot(MONDAY, "12:00", "12:30", true),
      slot(MONDAY, "12:30", "13:00", true),
    ]);
  });

  it("respects the appointment type's fixed duration when building slots", async () => {
    const service = createSlotsService(buildFakeQueries());
    const slots = await service.getSlotsForDoctor(maria.id, ecocardiograma.id, MONDAY, {
      rangeDays: 1,
      now: NOW_BEFORE_RANGE,
    });
    expect(slots.map((s) => s.startTime)).toEqual(["09:00", "09:45", "10:30", "11:15", "12:00"]);
    expect(slots[0]).toEqual(slot(MONDAY, "09:00", "09:45", true));
  });

  it("marks as unavailable the slots covered by an availability block", async () => {
    const block: AvailabilityBlock = {
      id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a19",
      doctorId: maria.id,
      date: MONDAY,
      startTime: "10:00",
      endTime: "11:00",
      reason: "Holiday",
    };
    const service = createSlotsService(
      buildFakeQueries({ listAvailabilityBlocksForDoctor: () => Promise.resolve([block]) })
    );
    const slots = await service.getSlotsForDoctor(maria.id, consulta.id, MONDAY, {
      rangeDays: 1,
      now: NOW_BEFORE_RANGE,
    });
    expect(slots.filter((s) => !s.available).map((s) => s.startTime)).toEqual(["10:00", "10:30"]);
    expect(slots.filter((s) => s.available).map((s) => s.startTime)).toEqual([
      "09:00",
      "09:30",
      "11:00",
      "11:30",
      "12:00",
      "12:30",
    ]);
  });

  it("marks as unavailable the slots overlapping a booked appointment", async () => {
    const booked: BookedAppointment[] = [{ startsAt: MONDAY_11AM_UTC, durationMinutes: 30 }];
    const service = createSlotsService(
      buildFakeQueries({ listBookedAppointmentsForDoctor: () => Promise.resolve(booked) })
    );
    const slots = await service.getSlotsForDoctor(maria.id, consulta.id, MONDAY, {
      rangeDays: 1,
      now: NOW_BEFORE_RANGE,
    });
    expect(slots.find((s) => s.startTime === "11:00")).toEqual(slot(MONDAY, "11:00", "11:30", false));
    expect(slots.find((s) => s.startTime === "11:30")).toEqual(slot(MONDAY, "11:30", "12:00", true));
  });

  it("keeps a longer booked appointment unavailable across overlapping slot starts", async () => {
    const booked: BookedAppointment[] = [{ startsAt: MONDAY_11AM_UTC, durationMinutes: 90 }];
    const service = createSlotsService(
      buildFakeQueries({ listBookedAppointmentsForDoctor: () => Promise.resolve(booked) })
    );
    const slots = await service.getSlotsForDoctor(maria.id, consulta.id, MONDAY, {
      rangeDays: 1,
      now: NOW_BEFORE_RANGE,
    });
    expect(slots.find((s) => s.startTime === "11:00")).toEqual(slot(MONDAY, "11:00", "11:30", false));
    expect(slots.find((s) => s.startTime === "11:30")).toEqual(slot(MONDAY, "11:30", "12:00", false));
    expect(slots.find((s) => s.startTime === "12:00")).toEqual(slot(MONDAY, "12:00", "12:30", false));
    expect(slots.find((s) => s.startTime === "12:30")).toEqual(slot(MONDAY, "12:30", "13:00", true));
  });

  it("does not show past time slots for the current day", async () => {
    const service = createSlotsService(buildFakeQueries());
    const slots = await service.getSlotsForDoctor(maria.id, consulta.id, MONDAY, {
      rangeDays: 1,
      now: new Date("2026-08-17T12:30:00.000Z"), // 09:30 clinic local
    });
    expect(slots.map((s) => s.startTime)).toEqual(["10:00", "10:30", "11:00", "11:30", "12:00", "12:30"]);
  });

  it("returns slots for each day the doctor has availability across the range", async () => {
    const wednesday: Availability = {
      id: "d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a20",
      doctorId: maria.id,
      weekday: 3,
      startTime: "09:00",
      endTime: "10:00",
    };
    const service = createSlotsService(
      buildFakeQueries({ listAvailabilityForDoctor: () => Promise.resolve([mondayAvailability, wednesday]) })
    );
    const slots = await service.getSlotsForDoctor(maria.id, consulta.id, MONDAY, {
      rangeDays: 3, // Mon 17, Tue 18, Wed 19
      now: NOW_BEFORE_RANGE,
    });
    expect(slots.map((s) => s.date)).toEqual([
      MONDAY,
      MONDAY,
      MONDAY,
      MONDAY,
      MONDAY,
      MONDAY,
      MONDAY,
      MONDAY,
      "2026-08-19",
      "2026-08-19",
    ]);
  });

  it("rejects an unknown doctor", async () => {
    const service = createSlotsService(buildFakeQueries());
    await expect(
      service.getSlotsForDoctor("00000000-0000-0000-0000-000000000000", consulta.id, MONDAY)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("defaults the range start to today in the clinic timezone", async () => {
    const service = createSlotsService(buildFakeQueries());
    // 2026-08-17 12:00 UTC is 2026-08-17 09:00 in Buenos Aires (UTC-3).
    const now = new Date("2026-08-17T12:00:00.000Z");
    const slots = await service.getSlotsForDoctor(maria.id, consulta.id, undefined, {
      now,
    });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]!.date).toBe(MONDAY);
  });

  it("rejects an unknown appointment type", async () => {
    const service = createSlotsService(buildFakeQueries());
    await expect(
      service.getSlotsForDoctor(maria.id, "00000000-0000-0000-0000-000000000000", MONDAY)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a doctor that does not offer the appointment type", async () => {
    const service = createSlotsService(
      buildFakeQueries({ getDoctorOffersType: () => Promise.resolve(false) })
    );
    await expect(service.getSlotsForDoctor(maria.id, consulta.id, MONDAY)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("returns a single available slot with its duration", async () => {
    const service = createSlotsService(buildFakeQueries());

    await expect(
      service.getAvailableSlot(maria.id, consulta.id, MONDAY, "10:00", NOW_BEFORE_RANGE)
    ).resolves.toEqual({ slot: slot(MONDAY, "10:00", "10:30", true), durationMinutes: 30 });
  });

  it("returns undefined when the requested slot is not available", async () => {
    const booked: BookedAppointment[] = [{ startsAt: MONDAY_11AM_UTC, durationMinutes: 30 }];
    const service = createSlotsService(
      buildFakeQueries({ listBookedAppointmentsForDoctor: () => Promise.resolve(booked) })
    );

    await expect(
      service.getAvailableSlot(maria.id, consulta.id, MONDAY, "11:00", NOW_BEFORE_RANGE)
    ).resolves.toBeUndefined();
  });
});