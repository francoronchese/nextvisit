export type DateParts = { year: number; month: number; day: number };
export type TimeParts = { hour: number; minute: number };

export function parseDateParts(date: string): DateParts {
  const [year, month, day] = date.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

export function parseTimeParts(time: string): TimeParts {
  const [hour, minute] = time.split(":").map(Number);
  return { hour: hour!, minute: minute! };
}