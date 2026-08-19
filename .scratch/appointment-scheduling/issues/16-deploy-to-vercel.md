# 16 — Deploy to Vercel + Neon production setup

**What to build:** Get the client and server live on Vercel (free tier) with a production Neon Postgres database, so the GitHub Actions reminder workflow (ADR-0005) has a real endpoint to hit.

**Blocked by:** none (requires GitHub repo — already exists at `github.com/francoronchese/nextvisit`)

**Status:** ready-for-agent

- [ ] Production database on Neon: create branch, set `DATABASE_URL` with connection pooling, run migrations (`pnpm --filter @nextvisit/server db:migrate` against prod)
- [ ] Seed the production catalog (specialties, doctors, health insurances, admin/secretary/doctor accounts) — or confirm it happens as part of first real use
- [ ] Vercel project created and both `client` and `server` wired to it (build + serverless function entry per ADR-0003)
- [ ] Vercel env vars set: `DATABASE_URL`, `AUTH_TOKEN_SECRET`, `REMINDERS_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `APP_URL` (production URL)
- [ ] Verify `GET /health` returns ok on the production URL
- [ ] Wire GitHub Actions scheduler workflows (`.github/workflows/reminders.yml` and `.github/workflows/no-show.yml`, hourly) hitting `POST <prod>/api/reminders` and `POST <prod>/api/no-shows`; set `REMINDERS_SECRET` as a GitHub repo secret and `APP_URL` as a repo variable
- [ ] Manual "Run workflow" verification: reminder email sent end-to-end against production