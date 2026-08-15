# 03 — Slot computation & viewing

**What to build:** After picking a doctor, the patient sees a grid of available slots for the next 30 days. Slots are computed as availability minus blocks minus already-booked appointments.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] `GET /api/doctors/:id/slots?date=YYYY-MM-DD` returns available slots for a date range
- [x] Slot computation query: doctor's weekly availability − availability_blocks − booked appointments
- [x] Slots respect the appointment type's fixed duration
- [x] UI: slot grid in `features/booking/` showing dates and times for the next 30 days
- [x] Past time slots are not shown
- [x] Visual distinction between available and unavailable slots
- [x] Service-layer unit tests for slot computation (availability minus blocks, minus booked)
- [x] Query-layer integration tests for the slot query against local Postgres
- [x] Seed data includes weekly availabilities so the slot grid is populated
