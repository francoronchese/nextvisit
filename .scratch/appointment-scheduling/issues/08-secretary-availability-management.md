# 08 — Secretary: availability management

**What to build:** The secretary sets each doctor's recurring weekly working hours and adds blocks for holidays and absences. Slots offered to patients are derived from this data.

**Blocked by:** 01, 07

**Status:** ready-for-review

- [x] `GET/POST/PUT/DELETE /api/admin/availability` CRUD for recurring weekly hours per doctor
- [x] `GET/POST/DELETE /api/admin/availability-blocks` CRUD for holiday/absence blocks
- [x] Secretary selects a doctor, sets days + time ranges for weekly availability
- [x] Secretary adds date-range blocks with a reason (holiday, absence)
- [x] UI: availability management forms in `features/admin/`
- [x] Service-layer unit tests: availability CRUD, block CRUD, slot derivation affected by blocks
- [x] Query-layer integration tests: blocks prevent slots on those dates

## Comments

- Implemented 2026-08-16. Block reason is enforced server-side as `enum("holiday", "absence")`
  (validator), matching the spec vocabulary; the client dropdown offers the same two values.
- "Date-range" blocks are modeled as a single `date` + `start_time`/`end_time` time range, per the
  established ticket-01 data model (`availability_blocks.date`); a multi-day absence is one block
  per day.
- Added `GET /api/admin/doctors` (no public all-doctors endpoint existed) so the secretary can
  select a doctor.
