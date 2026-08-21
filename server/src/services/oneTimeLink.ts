import { randomBytes } from "node:crypto";
import type { BookingQueries } from "../db/queries/bookings";
import { buildOneTimeLinkUrl } from "../utils/email";

// The unguessable credential behind the one-time link (CONTEXT.md: One-time
// Link). Bookings and reschedules issue it the same way: single-use, expiring
// when the appointment ends rather than when it starts, so the patient can keep
// managing the booking right up to the last minute.
export async function issueOneTimeLink(
  queries: Pick<BookingQueries, "createOneTimeLink">,
  appointment: { id: string; startsAt: string },
  durationMinutes: number
): Promise<{ token: string; url: string }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    new Date(appointment.startsAt).getTime() + durationMinutes * 60_000
  ).toISOString();
  await queries.createOneTimeLink({
    appointmentId: appointment.id,
    token,
    expiresAt,
  });
  return { token, url: buildOneTimeLinkUrl(token) };
}
