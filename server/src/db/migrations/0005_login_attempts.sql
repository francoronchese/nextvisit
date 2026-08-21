-- Staff login rate limiting (per email + IP): the login route is public, so
-- without a cap it is open to password brute force. Mirrors booking_attempts.

CREATE TABLE login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_attempts_email_attempted_at_idx ON login_attempts (email, attempted_at);

CREATE INDEX login_attempts_ip_attempted_at_idx ON login_attempts (ip, attempted_at);
