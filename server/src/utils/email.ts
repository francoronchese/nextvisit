import type { Appointment, Patient } from "@nextvisit/shared";
import { utcToClinicParts } from "@nextvisit/shared";
import { Resend } from "resend";

export type ConfirmationEmailInput = {
  to: string;
  patient: Patient;
  appointment: Appointment;
  oneTimeLinkUrl: string;
};

export type CancellationEmailInput = {
  to: string;
  patient: Patient;
  appointment: Appointment;
};

export type RescheduleConfirmationEmailInput = {
  to: string;
  patient: Patient;
  appointment: Appointment;
  oneTimeLinkUrl: string;
};

export type ReminderEmailInput = {
  to: string;
  patientFirstName: string;
  patientLastName: string;
  doctorName: string;
  appointmentTypeName: string;
  startsAt: string;
};

export type EmailNotifier = {
  sendConfirmationEmail(input: ConfirmationEmailInput): Promise<void>;
  sendCancellationEmail(input: CancellationEmailInput): Promise<void>;
  sendRescheduleConfirmationEmail(input: RescheduleConfirmationEmailInput): Promise<void>;
  sendReminderEmail(input: ReminderEmailInput): Promise<void>;
};

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:5173";
}

function formatAppointmentStart(startsAt: string): string {
  const { date, time } = utcToClinicParts(new Date(startsAt));
  return `${date} at ${time}`;
}

function buildConfirmationText(input: ConfirmationEmailInput): string {
  const { patient, appointment, oneTimeLinkUrl } = input;
  return [
    `Hello ${patient.firstName} ${patient.lastName},`,
    "",
    `Your appointment is confirmed for ${formatAppointmentStart(appointment.startsAt)}.`,
    "",
    "To view, cancel, or reschedule your appointment, open the link below:",
    oneTimeLinkUrl,
    "",
    "Next Visit",
  ].join("\n");
}

function buildConfirmationHtml(input: ConfirmationEmailInput): string {
  const { patient, appointment, oneTimeLinkUrl } = input;
  return `
    <p>Hello ${patient.firstName} ${patient.lastName},</p>
    <p>Your appointment is confirmed for <strong>${formatAppointmentStart(appointment.startsAt)}</strong>.</p>
    <p>To view, cancel, or reschedule your appointment, open the link below:</p>
    <p><a href="${oneTimeLinkUrl}">Manage your appointment</a></p>
    <p>Next Visit</p>
  `;
}

function buildCancellationText(input: CancellationEmailInput): string {
  const { patient, appointment } = input;
  return [
    `Hello ${patient.firstName} ${patient.lastName},`,
    "",
    `Your appointment for ${formatAppointmentStart(appointment.startsAt)} has been cancelled.`,
    "",
    "If you did not cancel this appointment, please contact the clinic.",
    "",
    "Next Visit",
  ].join("\n");
}

function buildCancellationHtml(input: CancellationEmailInput): string {
  const { patient, appointment } = input;
  return `
    <p>Hello ${patient.firstName} ${patient.lastName},</p>
    <p>Your appointment for <strong>${formatAppointmentStart(appointment.startsAt)}</strong> has been cancelled.</p>
    <p>If you did not cancel this appointment, please contact the clinic.</p>
    <p>Next Visit</p>
  `;
}

function buildRescheduleConfirmationText(input: RescheduleConfirmationEmailInput): string {
  const { patient, appointment, oneTimeLinkUrl } = input;
  return [
    `Hello ${patient.firstName} ${patient.lastName},`,
    "",
    `Your appointment has been rescheduled to ${formatAppointmentStart(appointment.startsAt)}.`,
    "",
    "To view, cancel, or reschedule your appointment, open the link below:",
    oneTimeLinkUrl,
    "",
    "Next Visit",
  ].join("\n");
}

function buildRescheduleConfirmationHtml(input: RescheduleConfirmationEmailInput): string {
  const { patient, appointment, oneTimeLinkUrl } = input;
  return `
    <p>Hello ${patient.firstName} ${patient.lastName},</p>
    <p>Your appointment has been rescheduled to <strong>${formatAppointmentStart(appointment.startsAt)}</strong>.</p>
    <p>To view, cancel, or reschedule your appointment, open the link below:</p>
    <p><a href="${oneTimeLinkUrl}">Manage your appointment</a></p>
    <p>Next Visit</p>
  `;
}

function buildReminderText(input: ReminderEmailInput): string {
  return [
    `Hello ${input.patientFirstName} ${input.patientLastName},`,
    "",
    `This is a reminder that you have an appointment with ${input.doctorName} (${input.appointmentTypeName}) on ${formatAppointmentStart(input.startsAt)}.`,
    "",
    "If you need to cancel or reschedule, use the link you received by email for this appointment.",
    "",
    "Next Visit",
  ].join("\n");
}

function buildReminderHtml(input: ReminderEmailInput): string {
  return `
    <p>Hello ${input.patientFirstName} ${input.patientLastName},</p>
    <p>This is a reminder that you have an appointment with <strong>${input.doctorName}</strong> (${input.appointmentTypeName}) on <strong>${formatAppointmentStart(input.startsAt)}</strong>.</p>
    <p>If you need to cancel or reschedule, use the link you received by email for this appointment.</p>
    <p>Next Visit</p>
  `;
}

export function createResendNotifier(): EmailNotifier {
  const apiKey = process.env.RESEND_API_KEY;
  const resend = apiKey ? new Resend(apiKey) : undefined;

  async function send(subject: string, text: string, html: string, to: string): Promise<void> {
    // Spec: emails go out whenever the patient provided an email; an empty
    // address (front-desk booking without an email) means nothing to send to.
    if (!to) {
      return;
    }
    if (!resend) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("RESEND_API_KEY is not set; skipping booking email");
      }
      return;
    }
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM ?? "Next Visit <no-reply@nextvisit.ar>",
      to: [to],
      subject,
      text,
      html,
    });
    if (error) {
      throw new Error(`failed to send email: ${error.message}`);
    }
  }

  return {
    sendConfirmationEmail(input) {
      return send(
        "Your appointment is confirmed",
        buildConfirmationText(input),
        buildConfirmationHtml(input),
        input.to
      );
    },
    sendCancellationEmail(input) {
      return send(
        "Your appointment has been cancelled",
        buildCancellationText(input),
        buildCancellationHtml(input),
        input.to
      );
    },
    sendRescheduleConfirmationEmail(input) {
      return send(
        "Your appointment has been rescheduled",
        buildRescheduleConfirmationText(input),
        buildRescheduleConfirmationHtml(input),
        input.to
      );
    },
    sendReminderEmail(input) {
      const { date, time } = utcToClinicParts(new Date(input.startsAt));
      return send(
        `Appointment reminder: ${date} at ${time}`,
        buildReminderText(input),
        buildReminderHtml(input),
        input.to
      );
    },
  };
}

export function buildOneTimeLinkUrl(token: string): string {
  return `${appUrl()}/appointments/${token}`;
}

export async function sendBestEffort(action: () => Promise<void>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error: unknown) {
    console.error("failed to send email:", error);
    return false;
  }
}

export const resendNotifier = createResendNotifier();