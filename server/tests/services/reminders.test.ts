import { describe, expect, it, vi } from "vitest";
import {
  createRemindersService,
  type RemindersServiceDeps,
} from "../../src/services/reminders";
import type { ReminderDue, RemindersQueries } from "../../src/db/queries/reminders";
import type { ReminderEmailInput } from "../../src/utils/email";

const NOW = new Date("2026-11-20T10:00:00.000Z");

const due: ReminderDue = {
  appointmentId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18",
  startsAt: "2026-11-21T10:00:00.000Z",
  patientFirstName: "Ana",
  patientLastName: "Pérez",
  patientEmail: "ana@example.com",
  doctorName: "María González",
  appointmentTypeName: "Cardiology consultation",
};

const secondDue: ReminderDue = {
  ...due,
  appointmentId: "d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a1b",
  startsAt: "2026-11-21T11:00:00.000Z",
  patientEmail: "caro@example.com",
};

function buildQueries(
  overrides: Partial<RemindersQueries> = {}
): RemindersQueries {
  return {
    listDueForReminder: vi.fn(() => Promise.resolve([due])),
    markReminderSent: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

function buildNotifier(
  send: (input: ReminderEmailInput) => Promise<void> = vi.fn(() => Promise.resolve())
) {
  return { sendReminderEmail: send };
}

function buildService(
  queries: RemindersQueries = buildQueries(),
  notifier: Pick<RemindersServiceDeps["notifier"], "sendReminderEmail"> = buildNotifier()
) {
  return createRemindersService({ queries, notifier });
}

describe("reminders service", () => {
  it("sends a reminder email for every due appointment and marks it sent", async () => {
    const queries = buildQueries({ listDueForReminder: vi.fn(() => Promise.resolve([due, secondDue])) });
    const notifier = buildNotifier();
    const service = buildService(queries, notifier);

    const result = await service.sendDue({ now: NOW });

    expect(queries.listDueForReminder).toHaveBeenCalledWith(NOW);
    expect(result).toEqual({ remindersSent: 2 });
    expect(notifier.sendReminderEmail).toHaveBeenCalledTimes(2);
    expect(notifier.sendReminderEmail).toHaveBeenCalledWith({
      to: due.patientEmail,
      patientFirstName: due.patientFirstName,
      patientLastName: due.patientLastName,
      doctorName: due.doctorName,
      appointmentTypeName: due.appointmentTypeName,
      startsAt: due.startsAt,
    });
    expect(queries.markReminderSent).toHaveBeenCalledWith(due.appointmentId);
    expect(queries.markReminderSent).toHaveBeenCalledWith(secondDue.appointmentId);
  });

  it("sends nothing when no appointments are due for a reminder", async () => {
    const queries = buildQueries({ listDueForReminder: vi.fn(() => Promise.resolve([])) });
    const notifier = buildNotifier();
    const service = buildService(queries, notifier);

    await expect(service.sendDue({ now: NOW })).resolves.toEqual({ remindersSent: 0 });
    expect(notifier.sendReminderEmail).not.toHaveBeenCalled();
    expect(queries.markReminderSent).not.toHaveBeenCalled();
  });

  it("keeps an appointment unmarked and un-counted when its email fails, while still sending the rest", async () => {
    const queries = buildQueries({ listDueForReminder: vi.fn(() => Promise.resolve([due, secondDue])) });
    const notifier = buildNotifier(
      vi.fn((input: ReminderEmailInput) =>
        input.to === "ana@example.com"
          ? Promise.reject(new Error("resend is down"))
          : Promise.resolve()
      )
    );
    const service = buildService(queries, notifier);

    const result = await service.sendDue({ now: NOW });

    expect(result).toEqual({ remindersSent: 1 });
    expect(notifier.sendReminderEmail).toHaveBeenCalledTimes(2);
    // The failed appointment is retried next tick; the delivered one is marked.
    expect(queries.markReminderSent).not.toHaveBeenCalledWith(due.appointmentId);
    expect(queries.markReminderSent).toHaveBeenCalledWith(secondDue.appointmentId);
  });
});