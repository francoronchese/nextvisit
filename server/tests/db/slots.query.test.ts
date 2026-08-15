import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import {
  getDoctorById,
  getDoctorOffersType,
  listAvailabilityBlocksForDoctor,
  listAvailabilityForDoctor,
  listBookedAppointmentsForDoctor,
} from "../../src/db/queries/slots";
import { clinicLocalToUtc } from "../../src/utils/clinicTimezone";
import {
  insertAppointment,
  insertAvailability,
  insertBlock,
  seedBaseFixture,
  truncateAll,
} from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("slot source queries", () => {
  it("getDoctorById returns the doctor", async () => {
    const fixture = await seedBaseFixture(pool, "slots");
    const doctor = await getDoctorById(fixture.doctorId);
    expect(doctor).toMatchObject({ id: fixture.doctorId, firstName: "Test", lastName: "Doctor" });
  });

  it("getDoctorById returns undefined for an unknown doctor", async () => {
    await expect(
      getDoctorById("00000000-0000-0000-0000-000000000000")
    ).resolves.toBeUndefined();
  });

  it("getDoctorOffersType reports whether the doctor offers the type", async () => {
    const fixture = await seedBaseFixture(pool, "slots");
    await expect(getDoctorOffersType(fixture.doctorId, fixture.typeId)).resolves.toBe(true);
    await expect(
      getDoctorOffersType(fixture.doctorId, "00000000-0000-0000-0000-000000000000")
    ).resolves.toBe(false);
  });

  it("listAvailabilityForDoctor returns weekly windows as HH:MM strings", async () => {
    const fixture = await seedBaseFixture(pool, "slots");
    await insertAvailability(pool, fixture.doctorId);
    const availability = await listAvailabilityForDoctor(fixture.doctorId);
    expect(availability).toEqual([
      {
        id: expect.any(String),
        doctorId: fixture.doctorId,
        weekday: 1,
        startTime: "09:00",
        endTime: "13:00",
      },
    ]);
  });

  it("listAvailabilityBlocksForDoctor filters blocks by date range", async () => {
    const fixture = await seedBaseFixture(pool, "slots");
    await insertBlock(pool, fixture.doctorId, "2026-09-07");
    await insertBlock(pool, fixture.doctorId, "2026-09-21");

    const inRange = await listAvailabilityBlocksForDoctor(
      fixture.doctorId,
      "2026-09-07",
      "2026-09-19"
    );
    expect(inRange).toHaveLength(1);
    expect(inRange[0]).toMatchObject({
      doctorId: fixture.doctorId,
      date: "2026-09-07",
      startTime: "10:00",
      endTime: "11:00",
      reason: "Holiday",
    });

    const outOfRange = await listAvailabilityBlocksForDoctor(
      fixture.doctorId,
      "2026-09-22",
      "2026-09-30"
    );
    expect(outOfRange).toHaveLength(0);
  });

  it("listBookedAppointmentsForDoctor returns only scheduled appointments in UTC", async () => {
    const fixture = await seedBaseFixture(pool, "slots");
    const startUtc = clinicLocalToUtc("2026-09-07", "11:00").toISOString();
    await insertAppointment(pool, { ...fixture, startsAt: startUtc });
    await insertAppointment(pool, {
      ...fixture,
      startsAt: clinicLocalToUtc("2026-09-07", "12:00").toISOString(),
      status: "cancelled",
    });
    await insertAppointment(pool, {
      ...fixture,
      startsAt: clinicLocalToUtc("2026-09-07", "13:00").toISOString(),
      status: "ended",
      attendance: "no_show",
    });

    const booked = await listBookedAppointmentsForDoctor(
      fixture.doctorId,
      new Date("2026-09-07T00:00:00.000Z"),
      new Date("2026-09-08T00:00:00.000Z")
    );
    expect(booked).toEqual([{ startsAt: startUtc, durationMinutes: 30 }]);
  });
});