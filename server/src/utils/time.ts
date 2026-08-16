import { parseTimeParts } from "@nextvisit/shared";

export function timeToMinutes(time: string): number {
  const { hour, minute } = parseTimeParts(time);
  return hour * 60 + minute;
}