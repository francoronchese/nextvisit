# 10 — Secretary: attendance & copay

**What to build:** When a patient arrives, the secretary marks the appointment as attended (flipping no-show if needed) and records the copay amount, pre-filled from the patient's health insurance.

**Blocked by:** 04, 07

**Status:** ready-for-agent

- [ ] `PATCH /api/admin/appointments/:id` updates attendance status and copay
- [ ] Copay amount pre-filled from `health_insurances` table based on patient's insurance
- [ ] Secretary confirms or adjusts the copay amount and marks paid
- [ ] No-show → attended flip corrects the automatic mark
- [ ] UI: attendance/copay form in `features/admin/` with pre-filled copay
- [ ] Service-layer unit tests: copay pre-fill, attendance flip, no-show correction
- [ ] API contract test: secretary records copay and marks attended
