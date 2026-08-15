# 02 — Catalog browsing (specialty → type → doctor)

**What to build:** The patient navigates a multi-step form to pick a specialty, then an appointment type within that specialty, then a doctor who offers that type. Each step shows only relevant options.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] `GET /api/specialties` returns all specialties
- [x] `GET /api/specialties/:id/types` returns appointment types for a specialty
- [x] `GET /api/types/:id/doctors` returns doctors offering a given type
- [x] UI: multi-step form in `features/booking/` — step 1 (specialty), step 2 (type), step 3 (doctor)
- [x] Each step only advances after a selection is made
- [x] Back navigation between steps without losing previous selections
- [x] Service-layer unit tests for each query
- [x] API contract tests (Supertest) for each endpoint
