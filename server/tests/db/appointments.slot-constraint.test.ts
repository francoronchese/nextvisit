import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import {
  insertAppointment,
  seedBaseFixture,
  truncateAll,
  type BaseFixture,
} from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("appointments — no-overlap constraint", () => {
  it("rejects a second appointment for the same doctor at the same start time", async () => {
    const fixture = await seedBaseFixture(pool, "constraint");
    const startsAt = "2026-09-01T10:00:00Z";
    await insertAppointment(pool, { ...fixture, startsAt });

    await expect(insertAppointment(pool, { ...fixture, startsAt })).rejects.toThrow(
      /violates exclusion constraint/
    );
  });

  it("rejects overlapping appointments with different start times", async () => {
    const fixture = await seedBaseFixture(pool, "constraint");
    // Fixture appointments last 30 minutes, so 10:00–10:30 overlaps 10:20–10:50.
    await insertAppointment(pool, { ...fixture, startsAt: "2026-09-01T10:00:00Z" });

    await expect(
      insertAppointment(pool, { ...fixture, startsAt: "2026-09-01T10:20:00Z" })
    ).rejects.toThrow(/violates exclusion constraint/);
  });

  it("allows adjacent appointments that do not overlap", async () => {
    const fixture = await seedBaseFixture(pool, "constraint");
    // 10:00–10:30 and 10:30–11:00 touch but never overlap.
    await insertAppointment(pool, { ...fixture, startsAt: "2026-09-01T10:00:00Z" });
    await expect(
      insertAppointment(pool, { ...fixture, startsAt: "2026-09-01T10:30:00Z" })
    ).resolves.toEqual(expect.any(String));
  });

  it("rejects a concurrent second booking for the same slot", async () => {
    const fixture = await seedBaseFixture(pool, "constraint");
    const startsAt = "2026-09-01T10:00:00Z";

    const results = await Promise.allSettled([
      insertAppointment(pool, { ...fixture, startsAt }),
      insertAppointment(pool, { ...fixture, startsAt }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]!.reason)).toMatch(/violates exclusion constraint/);
  });

  it("allows a second appointment for a different doctor at the same start time", async () => {
    const fixture = await seedBaseFixture(pool, "constraint");
    const other = await seedBaseFixture(pool, "constraint");
    await insertAppointment(pool, { ...fixture, startsAt: "2026-09-01T10:00:00Z" });
    await expect(
      insertAppointment(pool, { ...other, startsAt: "2026-09-01T10:00:00Z" })
    ).resolves.toEqual(expect.any(String));
  });

  it("releases the slot once the appointment is cancelled", async () => {
    const fixture = await seedBaseFixture(pool, "constraint");
    const startsAt = "2026-09-01T10:00:00Z";
    await insertAppointment(pool, { ...fixture, startsAt });
    await pool.query(
      "UPDATE appointments SET status = 'cancelled' WHERE doctor_id = $1 AND starts_at = $2",
      [fixture.doctorId, startsAt]
    );
    await expect(
      insertAppointment(pool, { ...fixture, startsAt })
    ).resolves.toEqual(expect.any(String));
  });
});