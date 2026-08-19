# 15 — No-show auto-mark (cron)

**What to build:** A scheduled job marks appointments as no-show when their start time passes. The secretary can then flip them to attended when the patient arrives.

**Blocked by:** 04

**Status:** ready-for-review

- [x] Server-side no-show job (`POST /api/no-shows`) marks appointments as no-show when `starts_at` has passed
- [x] Only affects `scheduled` status appointments (not cancelled or already ended)
- [x] Service-layer unit tests: cron marks correct appointments, skips already-ended
- [x] Query-layer integration tests: status update applied correctly

## Comments

- The hourly GitHub Actions scheduled workflow hits `POST /api/no-shows` (`REMINDERS_SECRET` bearer) and marks scheduled appointments whose `starts_at` passed as ended + `no_show`. The workflow file (`.github/workflows/no-show.yml`) is wired during deploy alongside the reminder workflow (ticket 16).
