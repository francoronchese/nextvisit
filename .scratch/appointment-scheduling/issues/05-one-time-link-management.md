# 05 — One-time link management (cancel/reschedule)

**What to build:** The patient uses the one-time link from their email to view, cancel, or reschedule their appointment. The link is single-use and expires when the appointment ends.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `GET /api/appointments/:token` returns appointment details if token is valid
- [ ] `POST /api/appointments/:token/cancel` cancels the appointment (within cancellation window)
- [ ] `POST /api/appointments/:token/reschedule` atomically releases old slot and books new one
- [ ] Cancellation window: online cancel/reschedule allowed until 3h before the appointment
- [ ] After use or appointment ended, the link stops working
- [ ] Reschedule sends a new confirmation email with a new one-time link
- [ ] UI: appointment detail page with cancel and reschedule actions
- [ ] Service-layer unit tests: cancel within window, cancel after window rejected, atomic reschedule, token expiry
- [ ] API contract tests: cancel flow, reschedule flow
