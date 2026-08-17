import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import {
  createRemindersQueries,
  type RemindersQueries,
} from "../../src/db/queries/reminders";
import type { QueryExecutor } from "../../src/db/client";
import { seedBaseFixture, truncateAll } from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });
const NOW = new Date("2026-11-20T10:00:00.000Z");

function queries(): RemindersQueries {
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
  return createRemindersQueries(executor);
}

async function insertPatientWithEmail(
  fixture: { insuranceId: string },
  dni: string,
  email?: string
) {
  const rows = await pool.query(
    `INSERT INTO patients (dni, first_name, last_name, health_insurance_id, phone, email)
     VALUES ($1, 'Reminder', 'Patient', $2, '555-0100', $3) RETURNING id`,
    [dni, fixture.insuranceId, email ?? null]
  );
  return rows.rows[0].id as string;
}

async function insertAppointmentAt(
  fixture: { doctorId: string; typeId: string },
  patientId: string,
  startsAt: string,
  opts: { status?: string; reminded?: boolean } = {}
) {
  const rows = await pool.query(
    `INSERT INTO appointments
       (patient_id, doctor_id, appointment_type_id, starts_at, duration_minutes, booking_channel, copay_amount, status, reminder_sent_at)
     VALUES ($1, $2, $3, $4, 30, 'web', 100, $5, $6) RETURNING id`,
    [
      patientId,
      fixture.doctorId,
      fixture.typeId,
      startsAt,
      opts.status ?? "scheduled",
      opts.reminded ? NOW.toISOString() : null,
    ]
  );
  return rows.rows[0].id as string;
}

function hoursFromNow(hours: number): string {
  return new Date(NOW.getTime() + hours * 60 * 60 * 1000).toISOString();
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
});

beforeEach(async () => {
  // The reminders query is global (no doctor filter), so each test must start
  // from an empty table rather than stacking appointments from earlier tests.
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("reminders query", () => {
  it("lists scheduled appointments in the next 24h whose patient has an email, sorted by start", async () => {
    const fixture = await seedBaseFixture(pool, "reminder");
    const emailPatient = await insertPatientWithEmail(fixture, "30000001", "ana@example.com");
    const secondEmailPatient = await insertPatientWithEmail(fixture, "30000002", "caro@example.com");

    const early = await insertAppointmentAt(fixture, emailPatient, hoursFromNow(1));
    await insertAppointmentAt(fixture, secondEmailPatient, hoursFromNow(23));

    const due = await queries().listDueForReminder(NOW);

    expect(due).toHaveLength(2);
    expect(due.map((d) => d.appointmentId)).toEqual([early, expect.any(String)]);
    expect(due[0]).toMatchObject({
      patientFirstName: "Reminder",
      patientLastName: "Patient",
      patientEmail: "ana@example.com",
      doctorName: "Test Doctor",
      appointmentTypeName: expect.any(String),
    });
    expect(new Date(due[0]!.startsAt).getTime()).toBeLessThan(new Date(due[1]!.startsAt).getTime());
  });

  it("skips cancelled appointments even inside the window", async () => {
    const fixture = await seedBaseFixture(pool, "reminder-cancel");
    const patient = await insertPatientWithEmail(fixture, "30000003", "ana@example.com");
    await insertAppointmentAt(fixture, patient, hoursFromNow(2), { status: "cancelled" });

    const due = await queries().listDueForReminder(NOW);
    expect(due).toHaveLength(0);
  });

  it("skips appointments starting more than 24h out and ones already started", async () => {
    const fixture = await seedBaseFixture(pool, "reminder-window");
    const patient = await insertPatientWithEmail(fixture, "30000004", "ana@example.com");
    await insertAppointmentAt(fixture, patient, hoursFromNow(25));
    await insertAppointmentAt(fixture, patient, hoursFromNow(-1));

    const due = await queries().listDueForReminder(NOW);
    expect(due).toHaveLength(0);
  });

  it("skips patients without an email", async () => {
    const fixture = await seedBaseFixture(pool, "reminder-noemail");
    const patient = await insertPatientWithEmail(fixture, "30000005");
    await insertAppointmentAt(fixture, patient, hoursFromNow(3));

    const due = await queries().listDueForReminder(NOW);
    expect(due).toHaveLength(0);
  });

  it("skips appointments already reminded, and markReminderSent makes them so", async () => {
    const fixture = await seedBaseFixture(pool, "reminder-sent");
    const patient = await insertPatientWithEmail(fixture, "30000006", "ana@example.com");
    await insertAppointmentAt(fixture, patient, hoursFromNow(4), { reminded: true });
    const pending = await insertAppointmentAt(fixture, patient, hoursFromNow(5));

    const remindersQueries = queries();

    let due = await remindersQueries.listDueForReminder(NOW);
    expect(due.map((d) => d.appointmentId)).toEqual([pending]);

    await remindersQueries.markReminderSent(pending);

    due = await remindersQueries.listDueForReminder(NOW);
    expect(due).toHaveLength(0);
  });
});