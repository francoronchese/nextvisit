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

describe("appointments — unique slot constraint", () => {
  it("rejects a second appointment for the same doctor at the same start time", async () => {
    const fixture = await seedBaseFixture(pool, "constraint");
    const startsAt = "2026-09-01T10:00:00Z";
    await insertAppointment(pool, { ...fixture, startsAt });

    await expect(
      insertAppointment(pool, { ...fixture, startsAt })
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
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
    expect(String(rejected[0]!.reason)).toMatch(
      /duplicate key value violates unique constraint/
    );
  });

  it("allows a second appointment for the same doctor at a different start time", async () => {
    const fixture = await seedBaseFixture(pool, "constraint");
    await insertAppointment(pool, { ...fixture, startsAt: "2026-09-01T10:00:00Z" });
    await expect(
      insertAppointment(pool, { ...fixture, startsAt: "2026-09-01T11:00:00Z" })
    ).resolves.toBeUndefined();
  });

  it("allows a second appointment for a different doctor at the same start time", async () => {
    const fixture = await seedBaseFixture(pool, "constraint");
    const other = await seedBaseFixture(pool, "constraint");
    await insertAppointment(pool, { ...fixture, startsAt: "2026-09-01T10:00:00Z" });
    await expect(
      insertAppointment(pool, { ...other, startsAt: "2026-09-01T10:00:00Z" })
    ).resolves.toBeUndefined();
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
    ).resolves.toBeUndefined();
  });
});