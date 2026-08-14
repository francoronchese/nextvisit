# 03 — Slot computation & viewing

**What to build:** After picking a doctor, the patient sees a grid of available slots for the next 30 days. Slots are computed as availability minus blocks minus already-booked appointments.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `GET /api/doctors/:id/slots?date=YYYY-MM-DD` returns available slots for a date range
- [ ] Slot computation query: doctor's weekly availability − availability_blocks − booked appointments
- [ ] Slots respect the appointment type's fixed duration
- [ ] UI: slot grid in `features/booking/` showing dates and times for the next 30 days
- [ ] Past time slots are not shown
- [ ] Visual distinction between available and unavailable slots
- [ ] Service-layer unit tests for slot computation (availability minus blocks, minus booked)
- [ ] Query-layer integration tests for the slot query against local Postgres
