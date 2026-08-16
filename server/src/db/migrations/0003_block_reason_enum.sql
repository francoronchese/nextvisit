-- Spec: blocks always carry a reason from a closed vocabulary (holiday | absence).
-- Matches shared blockReasonEnum; mirrors the PG-enum pattern used by the other
-- closed vocabularies (booking_channel, appointment_status, attendance, user_role).

CREATE TYPE block_reason AS ENUM ('holiday', 'absence');

ALTER TABLE availability_blocks
  ALTER COLUMN reason TYPE block_reason USING reason::block_reason,
  ALTER COLUMN reason SET NOT NULL;