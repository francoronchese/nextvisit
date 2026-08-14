# 02 — Catalog browsing (specialty → type → doctor)

**What to build:** The patient navigates a multi-step form to pick a specialty, then an appointment type within that specialty, then a doctor who offers that type. Each step shows only relevant options.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `GET /api/specialties` returns all specialties
- [ ] `GET /api/specialties/:id/types` returns appointment types for a specialty
- [ ] `GET /api/types/:id/doctors` returns doctors offering a given type
- [ ] UI: multi-step form in `features/booking/` — step 1 (specialty), step 2 (type), step 3 (doctor)
- [ ] Each step only advances after a selection is made
- [ ] Back navigation between steps without losing previous selections
- [ ] Service-layer unit tests for each query
- [ ] API contract tests (Supertest) for each endpoint
