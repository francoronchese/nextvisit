import { describe, expect, it } from "vitest";
import type { Availability, AvailabilityBlock, Doctor } from "@nextvisit/shared";
import type { AvailabilityQueries } from "../../src/db/queries/availability";
import { createAvailabilityService } from "../../src/services/availability";

const DOCTOR_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const doctor: Doctor = {
  id: DOCTOR_ID,
  specialtyId: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16",
  firstName: "María",
  lastName: "González",
};

const availability: Availability = {
  id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18",
  doctorId: DOCTOR_ID,
  weekday: 1,
  startTime: "09:00",
  endTime: "13:00",
};

const block: AvailabilityBlock = {
  id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a19",
  doctorId: DOCTOR_ID,
  date: "2026-09-07",
  startTime: "10:00",
  endTime: "11:00",
  reason: "holiday",
};

const NO_MATCH = "00000000-0000-0000-0000-000000000000";

function buildFakeQueries(overrides: Partial<AvailabilityQueries> = {}): AvailabilityQueries {
  return {
    listAllDoctors: () => Promise.resolve([doctor]),
    getDoctorById: (id) => Promise.resolve(id === DOCTOR_ID ? doctor : undefined),
    listAvailabilityForDoctor: (doctorId) =>
      Promise.resolve(doctorId === DOCTOR_ID ? [availability] : []),
    createAvailability: (input) =>
      Promise.resolve({ id: availability.id, ...input }),
    updateAvailability: (id, input) =>
      Promise.resolve(id === availability.id ? { id, ...input } : undefined),
    deleteAvailability: (id) => Promise.resolve(id === availability.id),
    listAvailabilityBlocksForDoctor: (doctorId) =>
      Promise.resolve(doctorId === DOCTOR_ID ? [block] : []),
    createAvailabilityBlock: (input) => Promise.resolve({ id: block.id, ...input }),
    deleteAvailabilityBlock: (id) => Promise.resolve(id === block.id),
    ...overrides,
  };
}

describe("availability service", () => {
  it("lists all doctors", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    await expect(service.listDoctors()).resolves.toEqual([doctor]);
  });

  it("lists the weekly windows for an existing doctor", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    await expect(service.listAvailabilityForDoctor(DOCTOR_ID)).resolves.toEqual([availability]);
  });

  it("rejects listing availability for an unknown doctor", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    await expect(service.listAvailabilityForDoctor(NO_MATCH)).rejects.toMatchObject({ status: 404 });
  });

  it("creates a weekly window for an existing doctor", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    const created = await service.createAvailability({
      doctorId: DOCTOR_ID,
      weekday: 3,
      startTime: "14:00",
      endTime: "18:00",
    });
    expect(created).toMatchObject({ doctorId: DOCTOR_ID, weekday: 3, startTime: "14:00", endTime: "18:00" });
  });

  it("rejects creating availability for an unknown doctor", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    await expect(
      service.createAvailability({ doctorId: NO_MATCH, weekday: 1, startTime: "09:00", endTime: "13:00" })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("updates an existing weekly window", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    const updated = await service.updateAvailability(availability.id, {
      doctorId: DOCTOR_ID,
      weekday: 5,
      startTime: "08:00",
      endTime: "12:00",
    });
    expect(updated).toMatchObject({ id: availability.id, weekday: 5, startTime: "08:00", endTime: "12:00" });
  });

  it("rejects updating an unknown weekly window", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    await expect(
      service.updateAvailability(NO_MATCH, { doctorId: DOCTOR_ID, weekday: 1, startTime: "09:00", endTime: "13:00" })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejects updating availability for an unknown doctor", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    await expect(
      service.updateAvailability(availability.id, { doctorId: NO_MATCH, weekday: 1, startTime: "09:00", endTime: "13:00" })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("deletes an existing weekly window", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    await expect(service.deleteAvailability(availability.id)).resolves.toBeUndefined();
  });

  it("rejects deleting an unknown weekly window", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    await expect(service.deleteAvailability(NO_MATCH)).rejects.toMatchObject({ status: 404 });
  });

  it("lists the blocks for an existing doctor", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    await expect(service.listBlocksForDoctor(DOCTOR_ID)).resolves.toEqual([block]);
  });

  it("rejects listing blocks for an unknown doctor", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    await expect(service.listBlocksForDoctor(NO_MATCH)).rejects.toMatchObject({ status: 404 });
  });

  it("creates a block for an existing doctor", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    const created = await service.createBlock({
      doctorId: DOCTOR_ID,
      date: "2026-09-08",
      startTime: "09:00",
      endTime: "17:00",
      reason: "absence",
    });
    expect(created).toMatchObject({ doctorId: DOCTOR_ID, date: "2026-09-08", reason: "absence" });
  });

  it("rejects creating a block for an unknown doctor", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    await expect(
      service.createBlock({
        doctorId: NO_MATCH,
        date: "2026-09-08",
        startTime: "09:00",
        endTime: "17:00",
        reason: "absence",
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("deletes an existing block", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    await expect(service.deleteBlock(block.id)).resolves.toBeUndefined();
  });

  it("rejects deleting an unknown block", async () => {
    const service = createAvailabilityService(buildFakeQueries());
    await expect(service.deleteBlock(NO_MATCH)).rejects.toMatchObject({ status: 404 });
  });
});