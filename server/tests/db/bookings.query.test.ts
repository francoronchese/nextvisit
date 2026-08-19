import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import {
  createBookingQueries,
  type BookingQueries,
} from "../../src/db/queries/bookings";
import type { QueryExecutor } from "../../src/db/client";
import { seedBaseFixture, insertAppointment, truncateAll } from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });
const HOUR_MS = 60 * 60 * 1000;

function executor(): QueryExecutor {
  return {
    async query<T>(text: string, params?: unknown[]): Promise<T[]> {
      const result = await pool.query(text, params as never[]);
      return result.rows as T[];
    },
    async queryOne<T>(text: string, params?: unknown[]): Promise<T | undefined> {
      const rows = await pool.query(text, params as never[]).then((r) => r.rows);
      return rows[0] as T | undefined;
    },
  };
}

function bookingsQueries(): BookingQueries {
  return createBookingQueries(executor());
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * HOUR_MS).toISOString();
}

async function insertPatient(fixture: { insuranceId: string }, dni: string): Promise<string> {
  const rows = await pool.query(
    `INSERT INTO patients (dni, first_name, last_name, health_insurance_id, phone)
     VALUES ($1, 'AntiSpam', 'Patient', $2, '555-0100') RETURNING id`,
    [dni, fixture.insuranceId]
  );
  return rows.rows[0].id as string;
}

async function insertAttemptAt(dni: string, attemptedAt: string): Promise<void> {
  await pool.query(
    `INSERT INTO booking_attempts (dni, attempted_at) VALUES ($1, $2)`,
    [dni, attemptedAt]
  );
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
});

beforeEach(async () => {
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("booking queries — active appointment cap", () => {
  it("counts future scheduled appointments for the DNI across all booking channels", async () => {
    const fixture = await seedBaseFixture(pool, "cap-channels");
    const patientId = await insertPatient(fixture, "30000111");
    for (const [channel, offsetHours] of [
      ["web", 72],
      ["front_desk", 73],
      ["phone", 74],
    ] as const) {
      await insertAppointment(pool, {
        ...fixture,
        patientId,
        startsAt: hoursFromNow(offsetHours),
        channel,
      });
    }

    const count = await bookingsQueries().countActiveAppointmentsForDni("30000111");
    expect(count).toBe(3);
  });

  it("excludes cancelled and past appointments", async () => {
    const fixture = await seedBaseFixture(pool, "cap-exclude");
    const patientId = await insertPatient(fixture, "30000222");
    await insertAppointment(pool, { ...fixture, patientId, startsAt: hoursFromNow(72) });
    await insertAppointment(pool, {
      ...fixture,
      patientId,
      startsAt: hoursFromNow(73),
      status: "cancelled",
    });
    await insertAppointment(pool, { ...fixture, patientId, startsAt: hoursFromNow(-72) });

    const count = await bookingsQueries().countActiveAppointmentsForDni("30000222");
    expect(count).toBe(1);
  });

  it("ignores appointments belonging to other DNIs", async () => {
    const fixture = await seedBaseFixture(pool, "cap-other-dni");
    const patientId = await insertPatient(fixture, "30000333");
    await insertPatient(fixture, "30000444");
    await insertAppointment(pool, { ...fixture, patientId, startsAt: hoursFromNow(72) });

    const count = await bookingsQueries().countActiveAppointmentsForDni("30000444");
    expect(count).toBe(0);
  });
});

describe("booking queries — booking attempt rate limit", () => {
  it("recordBookingAttempt inserts a row that countRecentBookingAttempts counts", async () => {
    const queries = bookingsQueries();
    await queries.recordBookingAttempt("30000555");

    const count = await queries.countRecentBookingAttempts("30000555", hoursFromNow(-1));
    expect(count).toBe(1);
  });

  it("counts only attempts at or after the window start", async () => {
    const queries = bookingsQueries();
    await insertAttemptAt("30000666", hoursFromNow(-2));
    await insertAttemptAt("30000666", hoursFromNow(-0.5));
    await insertAttemptAt("30000666", hoursFromNow(0));

    const count = await queries.countRecentBookingAttempts("30000666", hoursFromNow(-1));
    expect(count).toBe(2);
  });

  it("counts only the DNI's own attempts", async () => {
    const queries = bookingsQueries();
    await insertAttemptAt("30000777", hoursFromNow(0));
    await insertAttemptAt("30000888", hoursFromNow(0));

    const count = await queries.countRecentBookingAttempts("30000777", hoursFromNow(-1));
    expect(count).toBe(1);
  });
});
