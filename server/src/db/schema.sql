-- Next Visit — database schema (raw SQL DDL, no ORM — see ADR-0002)
-- 12 tables: specialties, appointment_types, doctors, doctor_appointment_types,
-- availabilities, availability_blocks, patients, health_insurances, appointments,
-- one_time_links, users, booking_attempts

-- ============================================================================
-- Enums
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE booking_channel AS ENUM ('web', 'front_desk', 'phone');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'cancelled', 'ended');
CREATE TYPE attendance AS ENUM ('pending', 'attended', 'no_show');
CREATE TYPE user_role AS ENUM ('admin', 'secretary', 'doctor');

-- ============================================================================
-- Catalog
-- ============================================================================

CREATE TABLE specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_id uuid NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  UNIQUE (specialty_id, name)
);

CREATE TABLE doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_id uuid NOT NULL REFERENCES specialties(id),
  first_name text NOT NULL,
  last_name text NOT NULL
);

CREATE TABLE doctor_appointment_types (
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_type_id uuid NOT NULL REFERENCES appointment_types(id) ON DELETE CASCADE,
  PRIMARY KEY (doctor_id, appointment_type_id)
);

-- ============================================================================
-- Availability
-- ============================================================================

CREATE TABLE availabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  weekday integer NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (end_time > start_time)
);

CREATE TABLE availability_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  reason text,
  CHECK (end_time > start_time)
);

-- ============================================================================
-- Patients & insurance
-- ============================================================================

CREATE TABLE health_insurances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  copay_amount numeric(10,2) NOT NULL CHECK (copay_amount >= 0)
);

CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dni text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  health_insurance_id uuid NOT NULL REFERENCES health_insurances(id),
  phone text NOT NULL,
  email text
);

-- ============================================================================
-- Appointments
-- ============================================================================

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  doctor_id uuid NOT NULL REFERENCES doctors(id),
  appointment_type_id uuid NOT NULL REFERENCES appointment_types(id),
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  booking_channel booking_channel NOT NULL,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  attendance attendance NOT NULL DEFAULT 'pending',
  copay_amount numeric(10,2) NOT NULL CHECK (copay_amount >= 0),
  copay_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- No-show/attendance is a flag on ended, not a lifecycle state (ADR-0004):
  -- a non-ended appointment is always pending; an ended one is attended or no_show.
  CHECK (
    (status = 'ended' AND attendance IN ('attended', 'no_show'))
    OR (status <> 'ended' AND attendance = 'pending')
  )
);

-- Prevents double-booking the same doctor, even under concurrency (spec: never
-- double-booked even under concurrency): the exclusion constraint rejects any
-- two scheduled appointments whose times overlap, not just identical starts.
-- Cancelled appointments are excluded so their slot frees up for re-booking.
--
-- tstzrange and timestamptz + interval are STABLE (DST-dependent), so Postgres
-- refuses them in an index expression directly; the IMMUTABLE wrapper makes
-- the span usable as the exclusion key. Safe here: the clinic timezone has no
-- DST.
CREATE FUNCTION appointments_span(starts_at timestamptz, duration_minutes integer)
RETURNS tstzrange
LANGUAGE sql IMMUTABLE
AS $$ SELECT tstzrange(starts_at, starts_at + make_interval(mins => duration_minutes), '[)') $$;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap_excl
  EXCLUDE USING gist (
    doctor_id WITH =,
    appointments_span(starts_at, duration_minutes) WITH &&
  )
  WHERE (status <> 'cancelled');

CREATE INDEX appointments_patient_id_idx ON appointments (patient_id);
CREATE INDEX appointments_status_idx ON appointments (status);

-- ============================================================================
-- One-time links (cancel/reschedule authorization, see ADR-0001)
-- ============================================================================

CREATE TABLE one_time_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX one_time_links_appointment_id_idx ON one_time_links (appointment_id);

-- ============================================================================
-- Staff accounts
-- ============================================================================

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  doctor_id uuid REFERENCES doctors(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Anti-spam
-- ============================================================================

CREATE TABLE booking_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dni text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX booking_attempts_dni_attempted_at_idx ON booking_attempts (dni, attempted_at);

-- ============================================================================
-- Migration bookkeeping (maintained by server/src/db/migrate.ts)
-- ============================================================================

CREATE TABLE schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);