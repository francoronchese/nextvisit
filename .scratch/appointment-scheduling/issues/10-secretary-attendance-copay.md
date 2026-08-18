# 10 — Secretary: attendance & copay

**What to build:** When a patient arrives, the secretary marks the appointment as attended (flipping no-show if needed) and records the copay amount, pre-filled from the patient's health insurance.

**Blocked by:** 04, 07

**Status:** ready-for-review

- [x] `PATCH /api/admin/appointments/:id` updates attendance status and copay
- [x] Copay amount pre-filled from `health_insurances` table based on patient's insurance
- [x] Secretary confirms or adjusts the copay amount and marks paid
- [x] No-show → attended flip corrects the automatic mark
- [x] UI: attendance/copay form in `features/admin/` with pre-filled copay
- [x] Service-layer unit tests: copay pre-fill, attendance flip, no-show correction
- [x] API contract test: secretary records copay and marks attended
