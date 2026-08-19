import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import app from "../../src/index";
import { seedBaseFixture, truncateAll } from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

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

describe("POST /api/no-shows", () => {
  it("marks overdue scheduled appointments as no-show and leaves future ones untouched", async () => {
    const fixture = await seedBaseFixture(pool, "no-show-api");
    const overdue = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const rows = await pool.query(
      `INSERT INTO appointments
         (patient_id, doctor_id, appointment_type_id, starts_at, duration_minutes, booking_channel, copay_amount)
       VALUES ($1, $2, $3, $4, 30, 'web', 100), ($1, $2, $3, $5, 30, 'web', 100)
       RETURNING id`,
      [fixture.patientId, fixture.doctorId, fixture.typeId, overdue, future]
    );
    const [overdueId, futureId] = rows.rows.map((r) => r.id as string);

    const res = await request(app)
      .post("/api/no-shows")
      .set("Authorization", "Bearer test-reminders-secret")
      .expect(200);
    expect(res.body).toEqual({ noShowsMarked: 1 });

    const states = await pool.query("SELECT status, attendance FROM appointments WHERE id = ANY($1)", [
      [overdueId, futureId],
    ]);
    expect(states.rows).toContainEqual({ status: "ended", attendance: "no_show" });
    expect(states.rows).toContainEqual({ status: "scheduled", attendance: "pending" });
  });

  it("refuses requests without the scheduler secret", async () => {
    const res = await request(app).post("/api/no-shows").expect(401);
    expect(res.body).toEqual({ error: "unauthorized" });
  });
});