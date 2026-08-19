// Detects the constraint violations the booking paths map to "slot
// unavailable": the unique slot index (duplicate start) and the overlap
// exclusion constraint (SQLSTATE 23P01). Unique-name conflicts (23505) map to
// their own 409s in the services. Foreign keys (23503) are detected separately
// by isForeignKeyViolation — create/update here would mislabel one as a
// duplicate if they shared this helper.
export function isConstraintViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === "23505" || code === "23P01") return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && /(duplicate key|exclusion constraint)/.test(message);
}

export function isForeignKeyViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === "23503") return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && /foreign key/.test(message);
}