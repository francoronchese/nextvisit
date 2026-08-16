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

export type EmailNotifier = {
  sendConfirmationEmail(input: ConfirmationEmailInput): Promise<void>;
  sendCancellationEmail(input: CancellationEmailInput): Promise<void>;
  sendRescheduleConfirmationEmail(input: RescheduleConfirmationEmailInput): Promise<void>;
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

export function createResendNotifier(): EmailNotifier {
  const apiKey = process.env.RESEND_API_KEY;
  const resend = apiKey ? new Resend(apiKey) : undefined;

  async function send(subject: string, text: string, html: string, to: string): Promise<void> {
    if (!resend) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("RESEND_API_KEY is not set; skipping booking email");
      }
      return;
    }
    const { error } = await resend.emails.send({
      from: "Next Visit <no-reply@nextvisit.ar>",
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
  };
}

export function buildOneTimeLinkUrl(token: string): string {
  return `${appUrl()}/appointments/${token}`;
}

export const resendNotifier = createResendNotifier();