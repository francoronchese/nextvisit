import { formatDateLong, utcToClinicParts } from "@nextvisit/shared";

// An appointment's start is a UTC instant; always render it in clinic-local time.
export function formatAppointmentStart(startsAt: string): string {
  const { date, time } = utcToClinicParts(new Date(startsAt));
  return `${formatDateLong(date)} at ${time}`;
}