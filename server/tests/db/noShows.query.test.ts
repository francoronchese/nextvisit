import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import { createNoShowQueries, type NoShowQueries } from "../../src/db/queries/noShows";
import type { QueryExecutor } from "../../src/db/client";
import { seedBaseFixture, truncateAll } from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });
const NOW = new Date("2026-11-20T10:00:00.000Z");

function queries(): NoShowQueries {
  const executor: QueryExecutor = {
    async query<T>(text: string, params?: unknown[]): Promise<T[]> {
      const result = await pool.query(text, params as never[]);
      return result.rows as T[];
    },
    async queryOne<T>(text: string, params?: unknown[]): Promise<T | undefined> {
      const rows = await pool.query(text, params as never[]).then((r) => r.rows);
      return rows[0] as T | undefined;
    },
  };
  return createNoShowQueries(executor);
}

async function insertAppointmentAt(
  fixture: { doctorId: string; typeId: string },
  patientId: string,
  startsAt: string,
  opts: { status?: string; attendance?: string } = {}
) {
  const rows = await pool.query(
    `INSERT INTO appointments
       (patient_id, doctor_id, appointment_type_id, starts_at, duration_minutes, booking_channel, copay_amount, status, attendance)
     VALUES ($1, $2, $3, $4, 30, 'web', 100, $5, $6) RETURNING id`,
    [
      patientId,
      fixture.doctorId,
      fixture.typeId,
      startsAt,
      opts.status ?? "scheduled",
      opts.attendance ?? "pending",
    ]
  );
  return rows.rows[0].id as string;
}

async function getStatus(id: string) {
  const rows = await pool.query("SELECT status, attendance FROM appointments WHERE id = $1", [id]);
  return rows.rows[0] as { status: string; attendance: string };
}

function hoursFromNow(hours: number): string {
  return new Date(NOW.getTime() + hours * 60 * 60 * 1000).toISOString();
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
});

beforeEach(async () => {
  // The no-show query is global (no doctor filter), so each test must start
  // from an empty table rather than stacking appointments from earlier tests.
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("no-show query", () => {
  it("lists only scheduled appointments whose start time has passed", async () => {
    const fixture = await seedBaseFixture(pool, "no-show-due");
    const overdue = await insertAppointmentAt(fixture, fixture.patientId, hoursFromNow(-2));
    await insertAppointmentAt(fixture, fixture.patientId, hoursFromNow(1));

    const due = await queries().listOverdue(NOW);

    expect(due.map((d) => d.appointmentId)).toEqual([overdue]);
  });

  it("skips cancelled and already-ended appointments", async () => {
    const fixture = await seedBaseFixture(pool, "no-show-skip");
    await insertAppointmentAt(fixture, fixture.patientId, hoursFromNow(-2), { status: "cancelled" });
    await insertAppointmentAt(fixture, fixture.patientId, hoursFromNow(-2), {
      status: "ended",
      attendance: "no_show",
    });

    const due = await queries().listOverdue(NOW);

    expect(due).toHaveLength(0);
  });

  it("markNoShow ends the appointment with no_show attendance and refuses an already-ended one", async () => {
    const fixture = await seedBaseFixture(pool, "no-show-mark");
    const overdue = await insertAppointmentAt(fixture, fixture.patientId, hoursFromNow(-2));
    const alreadyEnded = await insertAppointmentAt(fixture, fixture.patientId, hoursFromNow(-1), {
      status: "ended",
      attendance: "no_show",
    });

    const noShowQueries = queries();

    expect(await noShowQueries.markNoShow(overdue, NOW)).toBe(true);
    await expect(getStatus(overdue)).resolves.toEqual({ status: "ended", attendance: "no_show" });

    // A second run must not re-mark an appointment that is already no-show.
    expect(await noShowQueries.markNoShow(overdue, NOW)).toBe(false);
    expect(await noShowQueries.markNoShow(alreadyEnded, NOW)).toBe(false);
  });

  it("markNoShow refuses an appointment whose start time has not passed", async () => {
    const fixture = await seedBaseFixture(pool, "no-show-future");
    const future = await insertAppointmentAt(fixture, fixture.patientId, hoursFromNow(1));

    const noShowQueries = queries();

    expect(await noShowQueries.markNoShow(future, NOW)).toBe(false);
    await expect(getStatus(future)).resolves.toEqual({ status: "scheduled", attendance: "pending" });
  });
});