-- 24h reminder emails are driven by the scheduled reminder job querying
-- upcoming appointments.
-- reminder_sent_at marks an appointment as reminded so the hourly job never
-- emails the same patient twice for the same appointment. NULL means "not yet
-- reminded"; cancelled appointments are filtered by status in the query.

ALTER TABLE appointments
  ADD COLUMN reminder_sent_at timestamptz;

CREATE INDEX appointments_reminder_due_idx
  ON appointments (status, starts_at)
  WHERE reminder_sent_at IS NULL;
