# 11 — Doctor: view appointments

**What to build:** The doctor logs in and sees a read-only list of their upcoming appointments with patient details.

**Blocked by:** 04, 07

**Status:** ready-for-agent

- [ ] `GET /api/admin/appointments` (filtered by doctor) returns upcoming appointments
- [ ] Read-only panel — no edit, cancel, or reschedule actions
- [ ] Shows patient name, DNI, appointment type, date/time, status
- [ ] UI: read-only appointment list in `features/admin/` (doctor view)
- [ ] Service-layer unit tests: query returns correct doctor's appointments
- [ ] API contract test: doctor sees only their own appointments
