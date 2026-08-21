import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { clinicLocalToUtc } from "@nextvisit/shared";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import app from "../../src/index";
import { insertAppointment, insertAvailability, seedBaseFixture, truncateAll } from "../fixtures";

type ResendSendArgs = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
};

const { ResendMock, sendMock } = vi.hoisted(() => {
  const sendMock = vi.fn(
    (_args: ResendSendArgs): Promise<{ data: { id: string }; error: null }> =>
      Promise.resolve({ data: { id: "mock-email-id" }, error: null })
  );
  const ResendMock = class {
    emails = { send: sendMock };
  };
  return { ResendMock, sendMock };
});

vi.mock("resend", () => ({ Resend: ResendMock }));

vi.hoisted(() => {
  process.env.RESEND_API_KEY = "test-resend-key";
});

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

const SECRETARY = {
  email: "actions-secretary@nextvisit.ar",
  password: "secret123",
};

const DOCTOR = {
  email: "actions-doctor@nextvisit.ar",
  password: "secret123",
};

// The fixture availability runs 09:00-13:00 on Mondays; the reschedule tests
// pick the next Monday so the target slot is always in the future, whatever day
// the suite runs on.
function nextMondayIso(): string {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = new Date(base.getTime() + offset * 86_400_000);
    if (candidate.getUTCDay() === 1) {
      return candidate.toISOString().slice(0, 10);
    }
  }
  throw new Error("no monday in the next 7 days");
}

const MONDAY = nextMondayIso();

function clinicIso(date: string, time: string): string {
  return clinicLocalToUtc({ date, time }).toISOString();
}

async function seedUsers(): Promise<void> {
  await pool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'secretary')`,
    [SECRETARY.email, bcrypt.hashSync(SECRETARY.password, 4)]
  );
  await pool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'doctor')`,
    [DOCTOR.email, bcrypt.hashSync(DOCTOR.password, 4)]
  );
}

async function staffToken(email: string, password: string): Promise<string> {
  const res = await request(app)
    .post("/api/admin/login")
    .send({ email, password })
    .expect(200);
  return res.body.token as string;
}

async function seedScheduledAppointment(prefix: string): Promise<{ id: string; patientId: string }> {
  const fixture = await seedBaseFixture(pool, prefix);
  await insertAvailability(pool, fixture.doctorId);
  const appointmentId = await insertAppointment(pool, {
    ...fixture,
    startsAt: clinicIso(MONDAY, "09:00"),
    channel: "front_desk",
  });
  // Give the patient an email so the notice email actually goes out.
  await pool.query("UPDATE patients SET email = $1 WHERE id = $2", [
    "ana@example.com",
    fixture.patientId,
  ]);
  return { id: appointmentId, patientId: fixture.patientId };
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
  await seedUsers();
});

afterAll(async () => {
  await pool.end();
});

beforeEach(() => {
  sendMock.mockClear();
});

describe("secretary cancel/reschedule API", () => {
  it("rejects cancelling without a staff session token", async () => {
    const { id } = await seedScheduledAppointment("act-401");
    const res = await request(app)
      .post(`/api/admin/appointments/${id}/cancel`)
      .send({})
      .expect(401);
    expect(res.body).toEqual({ error: "unauthorized" });
  });

  it("rejects a doctor session, whose panel is read-only (spec)", async () => {
    const { id } = await seedScheduledAppointment("act-403");
    const token = await staffToken(DOCTOR.email, DOCTOR.password);
    const res = await request(app)
      .post(`/api/admin/appointments/${id}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(403);
    expect(res.body).toEqual({ error: "forbidden" });
  });

  it("cancels a scheduled appointment by id and sends the cancellation email", async () => {
    const { id } = await seedScheduledAppointment("act-cancel");
    const token = await staffToken(SECRETARY.email, SECRETARY.password);

    const res = await request(app)
      .post(`/api/admin/appointments/${id}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(200);

    expect(res.body).toMatchObject({ id, status: "cancelled" });

    const rows = await pool.query("SELECT status FROM appointments WHERE id = $1", [id]);
    expect(rows.rows[0]).toEqual({ status: "cancelled" });

    const [args] = sendMock.mock.calls[0]!;
    expect(args.to).toEqual(["ana@example.com"]);
    expect(args.subject).toBe("Your appointment has been cancelled");
  });

  it("rejects cancelling an appointment that is not scheduled", async () => {
    const fixture = await seedBaseFixture(pool, "act-double");
    const appointmentId = await insertAppointment(pool, {
      ...fixture,
      startsAt: clinicIso(MONDAY, "09:00"),
      status: "cancelled",
    });
    const token = await staffToken(SECRETARY.email, SECRETARY.password);

    const res = await request(app)
      .post(`/api/admin/appointments/${appointmentId}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(404);
    expect(res.body).toEqual({ error: "appointment not found" });
  });

  it("rejects cancelling an appointment that does not exist", async () => {
    const token = await staffToken(SECRETARY.email, SECRETARY.password);
    const res = await request(app)
      .post("/api/admin/appointments/00000000-0000-4000-8000-000000000000/cancel")
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(404);
    expect(res.body).toEqual({ error: "appointment not found" });
  });

  it("reschedules an appointment to an open slot, keeping the booking channel and copay", async () => {
    const { id } = await seedScheduledAppointment("act-resched");
    const token = await staffToken(SECRETARY.email, SECRETARY.password);

    const res = await request(app)
      .post(`/api/admin/appointments/${id}/reschedule`)
      .set("Authorization", `Bearer ${token}`)
      .send({ date: MONDAY, startTime: "10:00" })
      .expect(200);

    // The reschedule frees the old row and books a fresh one (single transaction),
    // so a new appointment id comes back with the new start and the old booking
    // details preserved.
    expect(res.body).toMatchObject({
      id: expect.any(String),
      status: "scheduled",
      bookingChannel: "front_desk",
      copayAmount: 100,
      startsAt: clinicIso(MONDAY, "10:00"),
    });
    expect(res.body.id).not.toBe(id);

    const oldRow = await pool.query(
      "SELECT status, starts_at FROM appointments WHERE id = $1",
      [id]
    );
    expect(oldRow.rows[0]).toEqual({
      status: "cancelled",
      starts_at: new Date(clinicIso(MONDAY, "09:00")),
    });

    const newRow = await pool.query(
      "SELECT starts_at, booking_channel, copay_amount FROM appointments WHERE id = $1",
      [res.body.id as string]
    );
    expect(newRow.rows[0]).toEqual({
      starts_at: new Date(clinicIso(MONDAY, "10:00")),
      booking_channel: "front_desk",
      copay_amount: "100.00",
    });

    const [args] = sendMock.mock.calls[0]!;
    expect(args.subject).toBe("Your appointment has been rescheduled");
    expect(args.text).toContain("/appointments/");
  });

  it("rejects a reschedule onto a slot the doctor does not offer", async () => {
    const { id } = await seedScheduledAppointment("act-badslot");
    const token = await staffToken(SECRETARY.email, SECRETARY.password);

    // Tuesday has no availability window for the fixture doctor.
    const tuesday = new Date(new Date(`${MONDAY}T00:00:00Z`).getTime() + 86_400_000)
      .toISOString()
      .slice(0, 10);
    const res = await request(app)
      .post(`/api/admin/appointments/${id}/reschedule`)
      .set("Authorization", `Bearer ${token}`)
      .send({ date: tuesday, startTime: "10:00" })
      .expect(409);
    expect(res.body).toEqual({ error: "that slot is no longer available" });

    const rows = await pool.query("SELECT status, starts_at FROM appointments WHERE id = $1", [id]);
    // The failed reschedule leaves the original booking untouched.
    expect(rows.rows[0]).toEqual({
      status: "scheduled",
      starts_at: new Date(clinicIso(MONDAY, "09:00")),
    });
  });

  it("rejects a reschedule for an appointment that does not exist", async () => {
    const token = await staffToken(SECRETARY.email, SECRETARY.password);
    const res = await request(app)
      .post("/api/admin/appointments/00000000-0000-4000-8000-000000000000/reschedule")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: MONDAY, startTime: "10:00" })
      .expect(404);
    expect(res.body).toEqual({ error: "appointment not found" });
  });

  it("rejects a malformed reschedule payload", async () => {
    const { id } = await seedScheduledAppointment("act-badbody");
    const token = await staffToken(SECRETARY.email, SECRETARY.password);

    const res = await request(app)
      .post(`/api/admin/appointments/${id}/reschedule`)
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "not-a-date" })
      .expect(400);
    expect(res.body).toEqual({ error: "invalid body" });
  });
});