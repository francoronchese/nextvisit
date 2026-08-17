# 06 — Email system (confirmation + reminder + notices)

**What to build:** Transactional emails via Resend: booking confirmation (with one-time link), 24h reminder before appointment, and cancellation/reschedule notifications. Sent whenever the patient provided an email, regardless of booking channel.

**Blocked by:** 04, 05

**Status:** ready-for-review

- [x] Resend integration configured in `server/src/utils/`
- [x] Confirmation email sent on every booking (web or secretary) when email is provided
- [x] 24h reminder email via GitHub Actions scheduled workflow (skipped if appointment was cancelled)
- [x] Cancellation notice email when appointment is cancelled
- [x] Reschedule notice email when appointment is rescheduled (with new one-time link)
- [x] UI: confirmation screen shows "Confirmation email sent" toast/notification
- [x] UI: one-time link page shows "You will receive a reminder 24h before your appointment"
- [x] Service-layer unit tests: email triggered on booking, skipped on cancelled, reminder query logic
- [x] API contract test: booking triggers email (mock Resend)

## Comments

- Secretary bookings (ticket 09) reuse the same `EmailNotifier`; the sender is channel-agnostic and web-path is covered by the contract test. The secretary checkbox lands end-to-end with ticket 09.
- Reminders: `appointments.reminder_sent_at` (migration 0004) guards against duplicate sends; the hourly GitHub Actions scheduled workflow hits `POST /api/reminders` (`REMINDERS_SECRET` bearer) and the query only picks scheduled appointments in the next 24h whose patient has an email and that were not reminded yet.
- Cancellation/reschedule confirmation emails were already wired in tickets 04/05; the contract test now covers them end-to-end with the Resend SDK mocked so tests never touch the network.
