import { parseDateParts, parseTimeParts } from "@nextvisit/shared";

export const CLINIC_TIMEZONE = "America/Argentina/Buenos_Aires";

function getOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - instant.getTime();
}

export function clinicLocalToUtc(date: string, time: string): Date {
  const { year, month, day } = parseDateParts(date);
  const { hour, minute } = parseTimeParts(time);
  const naive = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = getOffsetMs(naive);
  return new Date(naive.getTime() - offset);
}

export function utcToClinicParts(instant: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}