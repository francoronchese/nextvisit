# 01 — Scaffolding + DB schema + shared schemas

**What to build:** A runnable monorepo with all database tables, shared Zod domain schemas, and seed data — the foundation every subsequent ticket builds on. No API routes, no UI.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] `.gitignore` at repo root (node_modules, dist, .env, .DS_Store, local Postgres files)
- [x] pnpm workspace monorepo with `client`, `server`, `shared` packages linked via `workspace:*`
- [x] `server/src/db/schema.sql` with all 12 tables: specialties, appointment_types, doctors, doctor_appointment_types, availabilities, availability_blocks, patients, health_insurances, appointments, one_time_links, users, booking_attempts (plus the `schema_migrations` bookkeeping table used by `migrate.ts`)
- [x] Unique constraint on appointments (doctor, starts_at) to prevent double-booking
- [x] Appointment lifecycle pinned down in schema + DATA-MODEL.md: status enum (scheduled / cancelled / ended) with no-show either as a flag on ended or a distinct status — CONTEXT.md defines the lifecycle as three states, tickets 10/15 treat no-show as a state
- [x] `shared/src/types/` with Zod domain schemas + inferred types for every domain entity (Patient, Doctor, Appointment, etc.)
- [x] `server/src/db/migrations/` with the initial migration
- [x] Seed script populating: 3–4 specialties with 1–2 doctors each, appointment types (with fixed durations) per specialty + doctor_appointment_types offerings, 4 health insurances with distinct copay amounts (IOMA, PAMI, OSDE, Swiss Medical), one Admin account, one Secretary, one Doctor per specialty
- [x] `pnpm dev` runs without errors (Vite client + Express server)
- [x] All tables created and seeded against local Postgres
- [x] `DATA-MODEL.md` at repo root (uppercase, next to `ARCHITECTURE.md`/`CONTEXT.md`) covering:
  - Data model overview (what the schema solves)
  - Main entities (the 12 tables, one line of purpose each)
  - Entity relationships as a Mermaid ER diagram (`erDiagram`, not ASCII — versionable, renders on GitHub)
  - Critical constraints
  - Access policies (application RBAC)
  - Migrations (table: date / file / description)
  - Seed data
- [x] Link to `DATA-MODEL.md` from `ARCHITECTURE.md` §4.1
- [x] `.env` with `DATABASE_URL` pointing to local Postgres (role + db `nextvisit` created first)
