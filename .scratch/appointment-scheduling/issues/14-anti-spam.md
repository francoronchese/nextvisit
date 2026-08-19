# 14 — Anti-spam (3 per DNI + rate limiting)

**What to build:** Prevent fake or excessive bookings: max 3 active future appointments per DNI across all booking channels, and rate limiting on booking attempts per DNI.

**Blocked by:** 04

**Status:** ready-for-review

- [x] `booking_attempts` table records attempts keyed by DNI with timestamps
- [x] Count query: active future appointments per DNI (all booking channels)
- [x] Rate limit: reject booking attempts that exceed threshold (configurable)
- [x] Booking endpoint returns clear error message when cap is hit
- [x] UI: patient sees "You have reached the maximum number of active appointments" on the booking form
- [x] Service-layer unit tests: cap enforced, rate limit enforced, error messages correct
- [x] Query-layer integration tests: count query correctness
