import type { Appointment, Patient } from "@nextvisit/shared";
import { Resend } from "resend";
import { utcToClinicParts } from "./clinicTimezone";

export type ConfirmationEmailInput = {
  to: string;
  patient: Patient;
  appointment: Appointment;
  oneTimeLinkUrl: string;
};

export type BookingNotifier = {
  sendConfirmationEmail(input: ConfirmationEmailInput): Promise<void>;
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

export function createResendNotifier(): BookingNotifier {
  const apiKey = process.env.RESEND_API_KEY;
  const resend = apiKey ? new Resend(apiKey) : undefined;

  return {
    async sendConfirmationEmail(input) {
      if (!resend) {
        if (process.env.NODE_ENV !== "test") {
          console.warn("RESEND_API_KEY is not set; skipping booking confirmation email");
        }
        return;
      }
      const { data, error } = await resend.emails.send({
        from: "Next Visit <no-reply@nextvisit.ar>",
        to: [input.to],
        subject: "Your appointment is confirmed",
        text: buildConfirmationText(input),
        html: buildConfirmationHtml(input),
      });
      if (error) {
        throw new Error(`failed to send confirmation email: ${error.message}`);
      }
    },
  };
}

export function buildOneTimeLinkUrl(token: string): string {
  return `${appUrl()}/appointments/${token}`;
}

export const resendNotifier = createResendNotifier();