# 09 — Secretary: booking on behalf

**What to build:** The secretary books appointments for patients who call or visit in person. The flow reuses the same catalog, slot computation, and booking logic as the public flow, but under the secretary's authenticated session.

**Blocked by:** 02, 03, 04, 07

**Status:** ready-for-agent

- [ ] `POST /api/admin/appointments` creates booking under secretary session
- [ ] Secretary fills patient data (email optional for front-desk patients)
- [ ] Same anti-spam rules apply (3 per DNI cap)
- [ ] Confirmation email sent if email provided (same as web bookings)
- [ ] UI: secretary booking form in `features/admin/` — specialty → type → doctor → slot → patient data → confirm
- [ ] Service-layer unit tests: secretary booking succeeds, email sent only when provided
- [ ] API contract test: secretary books and confirmation email triggered
