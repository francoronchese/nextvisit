# 01 — Scaffolding + DB schema + shared schemas

**What to build:** A runnable monorepo with all database tables, shared Zod domain schemas, and seed data — the foundation every subsequent ticket builds on. No API routes, no UI.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `.gitignore` at repo root (node_modules, dist, .env, .DS_Store, local Postgres files)
- [ ] pnpm workspace monorepo with `client`, `server`, `shared` packages linked via `workspace:*`
- [ ] `server/src/db/schema.sql` with all 12 tables: specialties, appointment_types, doctors, doctor_appointment_types, availabilities, availability_blocks, patients, health_insurances, appointments, one_time_links, users, booking_attempts
- [ ] Unique constraint on appointments (doctor, starts_at) to prevent double-booking
- [ ] Appointment lifecycle pinned down in schema + DATA-MODEL.md: status enum (scheduled / cancelled / ended) with no-show either as a flag on ended or a distinct status — CONTEXT.md defines the lifecycle as three states, tickets 10/15 treat no-show as a state
- [ ] `shared/src/types/` with Zod domain schemas + inferred types for every domain entity (Patient, Doctor, Appointment, etc.)
- [ ] `server/src/db/migrations/` with the initial migration
- [ ] Seed script populating: 3–4 specialties with 1–2 doctors each, appointment types (with fixed durations) per specialty + doctor_appointment_types offerings, 4 health insurances with distinct copay amounts (IOMA, PAMI, OSDE, Swiss Medical), one Admin account, one Secretary, one Doctor per specialty
- [ ] `pnpm dev` runs without errors (Vite client + Express server)
- [ ] All tables created and seeded against local Postgres
- [ ] `DATA-MODEL.md` at repo root (uppercase, next to `ARCHITECTURE.md`/`CONTEXT.md`) covering:
  - Data model overview (what the schema solves)
  - Main entities (the 12 tables, one line of purpose each)
  - Entity relationships as a Mermaid ER diagram (`erDiagram`, not ASCII — versionable, renders on GitHub)
  - Critical constraints
  - Access policies (application RBAC)
  - Migrations (table: date / file / description)
  - Seed data
- [ ] Link to `DATA-MODEL.md` from `ARCHITECTURE.md` §4.1
- [ ] `.env` with `DATABASE_URL` pointing to local Postgres (role + db `nextvisit` created first)
