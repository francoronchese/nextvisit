# 05 — One-time link management (cancel/reschedule)

**What to build:** The patient uses the one-time link from their email to view, cancel, or reschedule their appointment. The link is single-use and expires when the appointment ends.

**Blocked by:** 04

**Status:** ready-for-review

- [x] `GET /api/appointments/:token` returns appointment details if token is valid
- [x] `POST /api/appointments/:token/cancel` cancels the appointment (within cancellation window)
- [x] `POST /api/appointments/:token/reschedule` atomically releases old slot and books new one
- [x] Cancellation window: online cancel/reschedule allowed until 3h before the appointment
- [x] After use or appointment ended, the link stops working
- [x] Reschedule sends a new confirmation email with a new one-time link
- [x] UI: appointment detail page with cancel and reschedule actions
- [x] Service-layer unit tests: cancel within window, cancel after window rejected, atomic reschedule, token expiry
- [x] API contract tests: cancel flow, reschedule flow
