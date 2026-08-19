# 13 — Admin: health insurance → copay table

**What to build:** The admin manages the health insurance → copay mapping so that copay amounts are always correct when the secretary records attendance.

**Blocked by:** 01, 07

**Status:** ready-for-review

- [x] `GET/POST/PUT/DELETE /api/admin/health-insurances` CRUD for the copay table
- [x] Each entry: insurance name → copay amount
- [x] UI: table management form in `features/admin/` — create, edit, delete
- [x] Service-layer unit tests: CRUD operations, duplicate name rejected
- [x] API contract test: full CRUD flow
