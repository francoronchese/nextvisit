-- Replaces the exact-start unique index with an overlap exclusion constraint:
-- two appointments for the same doctor may never overlap, not just share a
-- start. This closes the gap where concurrent bookings at different but
-- overlapping start times (e.g. a 45-min slot at 09:00 and a 20-min one at
-- 09:20) both passed the unique index (spec: never double-booked even under
-- concurrency). Cancelled appointments stay excluded so their slot frees up.
--
-- tstzrange and timestamptz + interval are STABLE (DST-dependent), so Postgres
-- refuses them in an index expression directly; the IMMUTABLE wrapper makes
-- the span usable as the exclusion key. Safe here: the clinic timezone has no
-- DST.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE FUNCTION appointments_span(starts_at timestamptz, duration_minutes integer)
RETURNS tstzrange
LANGUAGE sql IMMUTABLE
AS $$ SELECT tstzrange(starts_at, starts_at + make_interval(mins => duration_minutes), '[)') $$;

DROP INDEX IF EXISTS appointments_doctor_starts_at_active_idx;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap_excl
  EXCLUDE USING gist (
    doctor_id WITH =,
    appointments_span(starts_at, duration_minutes) WITH &&
  )
  WHERE (status <> 'cancelled');