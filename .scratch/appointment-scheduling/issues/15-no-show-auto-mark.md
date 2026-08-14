# 15 — No-show auto-mark (cron)

**What to build:** A scheduled job marks appointments as no-show when their start time passes. The secretary can then flip them to attended when the patient arrives.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Vercel Cron endpoint marks appointments as no-show when `starts_at` has passed
- [ ] Only affects `scheduled` status appointments (not cancelled or already ended)
- [ ] Service-layer unit tests: cron marks correct appointments, skips already-ended
- [ ] Query-layer integration tests: status update applied correctly
