# 06 — Email system (confirmation + reminder + notices)

**What to build:** Transactional emails via Resend: booking confirmation (with one-time link), 24h reminder before appointment, and cancellation/reschedule notifications. Sent whenever the patient provided an email, regardless of booking channel.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] Resend integration configured in `server/src/utils/`
- [ ] Confirmation email sent on every booking (web or secretary) when email is provided
- [ ] 24h reminder email via Vercel Cron (skipped if appointment was cancelled)
- [ ] Cancellation notice email when appointment is cancelled
- [ ] Reschedule notice email when appointment is rescheduled (with new one-time link)
- [ ] UI: confirmation screen shows "Confirmation email sent" toast/notification
- [ ] UI: one-time link page shows "You will receive a reminder 24h before your appointment"
- [ ] Service-layer unit tests: email triggered on booking, skipped on cancelled, reminder query logic
- [ ] API contract test: booking triggers email (mock Resend)
