// Detects the two constraint violations the booking paths map to "slot
// unavailable": the unique slot index (duplicate start) and the overlap
// exclusion constraint (SQLSTATE 23P01).
export function isConstraintViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === "23505" || code === "23P01") return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && /(duplicate key|exclusion constraint)/.test(message);
}