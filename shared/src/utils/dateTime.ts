export type DateParts = { year: number; month: number; day: number };
export type TimeParts = { hour: number; minute: number };

// A clock time in the clinic's local timezone, independent of any UTC instant:
// the pair {date, time} always travels together (e.g. a slot's start).
export type ClinicLocalTime = { date: string; time: string };

export function parseDateParts(date: string): DateParts {
  const [year, month, day] = date.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

export function parseTimeParts(time: string): TimeParts {
  const [hour, minute] = time.split(":").map(Number);
  return { hour: hour!, minute: minute! };
}

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function toClinicDate(date: string): Date {
  const { year, month, day } = parseDateParts(date);
  return new Date(year, month - 1, day);
}

export function formatDateLong(date: string): string {
  return LONG_DATE_FORMATTER.format(toClinicDate(date));
}

export function formatDateShort(date: string): string {
  const formatted = SHORT_DATE_FORMATTER.format(toClinicDate(date));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}