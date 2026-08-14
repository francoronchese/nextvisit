# 08 — Secretary: availability management

**What to build:** The secretary sets each doctor's recurring weekly working hours and adds blocks for holidays and absences. Slots offered to patients are derived from this data.

**Blocked by:** 01, 07

**Status:** ready-for-agent

- [ ] `GET/POST/PUT/DELETE /api/admin/availability` CRUD for recurring weekly hours per doctor
- [ ] `GET/POST/DELETE /api/admin/availability-blocks` CRUD for holiday/absence blocks
- [ ] Secretary selects a doctor, sets days + time ranges for weekly availability
- [ ] Secretary adds date-range blocks with a reason (holiday, absence)
- [ ] UI: availability management forms in `features/admin/`
- [ ] Service-layer unit tests: availability CRUD, block CRUD, slot derivation affected by blocks
- [ ] Query-layer integration tests: blocks prevent slots on those dates
