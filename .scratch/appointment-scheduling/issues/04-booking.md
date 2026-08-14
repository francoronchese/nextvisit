# 04 — Booking (patient self-service)

**What to build:** The patient fills their personal data (DNI, name, last name, health insurance, phone, email), picks a slot, and gets an instant confirmation. A one-time link is created and a confirmation email is sent.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] `POST /api/bookings` creates Patient (or updates if DNI exists) + Appointment + One-time Link
- [ ] Patient form validates: DNI, first name, last name, health insurance, phone, email
- [ ] Confirmation email sent via Resend with one-time link (email required on web bookings; optional only for secretary bookings, matching CONTEXT.md)
- [ ] Anti-spam: booking rejected if patient has ≥3 active future appointments (error message shown)
- [ ] UI: patient data form → slot selection → confirmation screen with appointment details
- [ ] Concurrency: if slot was taken by someone else, show "slot no longer available" with refreshed grid
- [ ] Service-layer unit tests: booking succeeds, 3-per-DNI cap enforced, concurrency rejection
- [ ] API contract test: full book → confirm flow
