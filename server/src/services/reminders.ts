import { query, queryOne } from "../db/client";
import {
  createRemindersQueries,
  type ReminderDue,
  type RemindersQueries,
} from "../db/queries/reminders";
import {
  resendNotifier,
  sendBestEffort,
  type EmailNotifier,
  type ReminderEmailInput,
} from "../utils/email";

export type RemindersServiceDeps = {
  queries: RemindersQueries;
  notifier: Pick<EmailNotifier, "sendReminderEmail">;
};

export type RemindersService = {
  sendDue(options?: { now?: Date }): Promise<{ remindersSent: number }>;
};

function toReminderEmailInput(due: ReminderDue): ReminderEmailInput {
  return {
    to: due.patientEmail,
    patientFirstName: due.patientFirstName,
    patientLastName: due.patientLastName,
    doctorName: due.doctorName,
    appointmentTypeName: due.appointmentTypeName,
    startsAt: due.startsAt,
  };
}

export function createRemindersService(deps: RemindersServiceDeps): RemindersService {
  const { queries, notifier } = deps;
  return {
    async sendDue(options) {
      const now = options?.now ?? new Date();
      const due = await queries.listDueForReminder(now);

      let remindersSent = 0;
      for (const reminder of due) {
        // Best-effort per patient so a transient Resend failure never blocks the
        // rest. Only mark the reminder sent when it actually went out: a failed
        // send is retried on the next run.
        const sent = await sendBestEffort(() =>
          notifier.sendReminderEmail(toReminderEmailInput(reminder))
        );
        if (sent) {
          await queries.markReminderSent(reminder.appointmentId);
          remindersSent += 1;
        }
      }
      return { remindersSent };
    },
  };
}

const poolRemindersQueries = createRemindersQueries({ query, queryOne });

export const remindersService: RemindersService = createRemindersService({
  queries: poolRemindersQueries,
  notifier: resendNotifier,
});