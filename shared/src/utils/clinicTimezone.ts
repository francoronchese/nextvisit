import type { ClinicLocalTime } from "./dateTime";
import { parseDateParts, parseTimeParts } from "./dateTime";

export const CLINIC_TIMEZONE = "America/Argentina/Buenos_Aires";

const CLINIC_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: CLINIC_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function clinicPart(instant: Date, type: string): string {
  return CLINIC_FORMATTER.formatToParts(instant).find((p) => p.type === type)!.value;
}

function getOffsetMs(instant: Date): number {
  const asUtc = Date.UTC(
    Number(clinicPart(instant, "year")),
    Number(clinicPart(instant, "month")) - 1,
    Number(clinicPart(instant, "day")),
    Number(clinicPart(instant, "hour")),
    Number(clinicPart(instant, "minute")),
    Number(clinicPart(instant, "second"))
  );
  return asUtc - instant.getTime();
}

export function clinicLocalToUtc(local: ClinicLocalTime): Date {
  const { year, month, day } = parseDateParts(local.date);
  const { hour, minute } = parseTimeParts(local.time);
  const naive = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = getOffsetMs(naive);
  return new Date(naive.getTime() - offset);
}

export function utcToClinicParts(instant: Date): ClinicLocalTime {
  return {
    date: `${clinicPart(instant, "year")}-${clinicPart(instant, "month")}-${clinicPart(instant, "day")}`,
    time: `${clinicPart(instant, "hour")}:${clinicPart(instant, "minute")}`,
  };
}