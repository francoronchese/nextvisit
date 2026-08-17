# Next Visit — Appointment Scheduling (MVP)

Status: ready-for-agent

## Problem Statement

Patients of a single clinic need to book, cancel, and reschedule medical appointments on the web without creating an account. The clinic also needs to stop fake bookings, protect patient data, and handle elderly patients who book by phone or at the front desk. There is currently no system: scheduling happens manually.

## Solution

A web app with two surfaces: a public booking flow where a patient enters their DNI, name, last name, health insurance, phone, and email, then picks a specialty, an appointment type, a doctor, and an available slot — confirmed instantly, with an email confirmation containing a single-use one-time link for cancelling or rescheduling, plus a reminder 24h before. And an admin panel (login) where the secretary maintains doctor availability, books on behalf of phone/front-desk patients, and records attendance and copays; the doctor sees their upcoming patients read-only; the admin manages staff credentials and the health-insurance → copay table.

## User Stories

1. As a patient, I want to book an appointment online without creating an account, so that scheduling takes under a minute.
2. As a patient, I want to enter my DNI, name, last name, health insurance, phone, and email, so that the clinic can identify and contact me.
3. As a patient, I want to pick a specialty first, so that I can find the right area of care.
4. As a patient, I want to pick an appointment type within that specialty, so that I book the right kind of care.
5. As a patient, I want to see only the doctors who offer the chosen appointment type, so that I don't browse irrelevant options.
6. As a patient, I want to see a doctor's available slots for the next 30 days, so that I can pick a date and time that suit me.
7. As a patient, I want my booking confirmed instantly when I pick a slot, so that I don't wait for staff approval.
8. As a patient, I want to be told that a slot was just taken by someone else, with the day's grid refreshed, so that I can immediately pick another.
9. As a patient, I want an immediate email confirmation with my appointment details and a one-time link, so that I can reference and manage the appointment later.
10. As a patient, I want a reminder email 24h before my appointment (unless I cancelled), so that I don't forget.
11. As a patient, I want to cancel my appointment online up to the end of the cancellation window (3h before), using the one-time link, so that the slot becomes free for someone else.
12. As a patient, I want to reschedule my appointment online up to the end of the cancellation window, using the one-time link, so that I can change the time without losing the appointment.
13. As a patient, I want rescheduling to be a single atomic operation that frees the old slot and takes the new one, so that I can never end up double-booked.
14. As a patient, I want a new email with a new one-time link after rescheduling, so that I can manage the new appointment.
15. As a patient, I want the one-time link to stop working after it is used or once the appointment passes, so that it can't be reused or abused.
16. As a patient who doesn't use the web, I want to book at the front desk or by phone through the secretary, so that the system is not a barrier.
17. As a patient without an email, I want to still get an appointment at the front desk, so that I'm not excluded.
18. As a patient who gave an email at the front desk, I want the same confirmation and reminder emails as web bookings, so that I stay informed.
19. As the clinic, I want a maximum of 3 active future appointments per DNI across all booking channels, so that one person can't flood the schedule.
20. As the clinic, I want booking attempts rate-limited by DNI, so that fake bookings are discouraged.
21. As a secretary, I want to log in to the admin panel with email and password, so that I can manage the schedule.
22. As a secretary, I want to set each doctor's recurring weekly availability, so that slots are generated from it.
23. As a secretary, I want to add blocks for holidays and absences, so that no slots are offered on those days.
24. As a secretary, I want to book appointments on behalf of patients by phone or at the front desk, so that non-web patients can be scheduled.
25. As a secretary, I want to cancel and reschedule appointments for patients without an email, so that they can still manage their appointments.
26. As a secretary, I want appointments to be marked no-show automatically when their time passes, so that I know who didn't come without extra work.
27. As a secretary, I want to flip a no-show to attended when the patient arrives, so that attendance records are accurate.
28. As a secretary, I want to record the copay paid when the patient arrives, so that billing is tracked.
29. As a secretary, I want the copay amount pre-filled from the patient's health insurance, so that I only confirm it.
30. As a doctor, I want to log in and see my upcoming appointments with patient details, so that I know who is coming.
31. As a doctor, I want my panel to be read-only, so that I can't accidentally change data.
32. As an admin, I want to create credentials for secretaries and doctors, so that staff can access the panel.
33. As an admin, I want to manage the health-insurance → copay table, so that copays are always correct.
34. As the system, I want slots computed as availability minus blocks minus already-booked appointments, so that bookings only hit real open times.
35. As the system, I want a unique constraint on a slot (doctor + date + start time), so that the same slot can never be double-booked even under concurrency.
36. As the clinic, I want appointments to keep their lifecycle (scheduled, cancelled, ended), so that history is preserved.
37. As an elderly patient, I want the booking flow to be simple and legible, so that I can book without help.

## Implementation Decisions

- **Monorepo**: pnpm workspace with `client`, `server`, and `shared` packages. `shared` holds the Zod domain schemas + inferred types and framework-agnostic utils consumed by both sides.
- **Stack**: React + Vite + Tailwind (client); Node.js + Express + TypeScript (server); Postgres on Neon via raw SQL only (no ORM — ADR-0002); both deployed on Vercel serverless (ADR-0003); email via Resend; pnpm as package manager.
- **Booking flow (public)**: form (DNI, name, last name, health insurance, phone, email) → specialty → appointment type → doctors offering that type → slot within a 30-day horizon → instant confirmation.
- **Patient identity**: the Patient record is created on first booking and updated on later ones (DNI is the identity anchor). No patient accounts.
- **Slot computation**: slots are not stored as rows — the day's grid is computed from the doctor's Availability minus Availability Blocks minus booked Appointments. Double-booking is prevented by a unique constraint on appointments (doctor, starts_at), enforced at the DB.
- **Concurrency**: when two patients grab the same slot, the DB constraint rejects the second; the loser sees "that slot is no longer available" with the day's grid refreshed.
- **One-time link**: a random, unguessable token per Appointment, single-use, expires when the appointment passes; it is the only authorization for cancel/reschedule (ADR-0001).
- **Rescheduling**: one atomic transaction that releases the old slot and books the new one; sends a new confirmation email with a new one-time link. Same 3h cancellation window as cancellation.
- **Cancellation window**: online cancel/reschedule allowed until 3h before the appointment; after that, only the secretary can do it.
- **Anti-spam**: max 3 active future Appointments per DNI enforced inside the booking transaction (all Booking Channels); `booking_attempts` table rate-limits attempts per DNI.
- **No-show**: a scheduled job marks Appointments as no-show when their start time passes; the secretary flips them to attended when the patient arrives and pays (ADR-0004).
- **Copay**: recorded on the Appointment from the health_insurance → copay table; the secretary confirms the amount and marks paid.
- **Roles & admin panel**: `users` table with roles admin/secretary/doctor, email + hashed password. Admin: credentials + health-insurance/copay CRUD. Secretary: availability, availability blocks, booking on behalf, cancel/reschedule any appointment, attendance/copay. Doctor: read-only list of their upcoming appointments.
- **Emails**: confirmation (immediate), reminder (24h before final appointment time, skipped if cancelled; sent even if rescheduled within 24h), and reschedule/cancel notices. Sent whenever the patient provided an email, regardless of Booking Channel.
- **API contract** (REST, JSON, Zod-validated):
  - `GET /api/specialties`, `GET /api/specialties/:id/types`, `GET /api/types/:id/doctors`, `GET /api/doctors/:id/slots?typeId=<uuid>&date=YYYY-MM-DD` (typeId required — slots must respect the appointment type's fixed duration; date optional, defaults to today in the clinic timezone), `GET /api/health-insurances` (public form dropdown)
  - `POST /api/bookings` (creates Patient + Appointment, triggers confirmation email)
  - `GET /api/appointments/:token`, `POST /api/appointments/:token/cancel`, `POST /api/appointments/:token/reschedule`
  - Admin: `POST /api/admin/login`; availability & blocks CRUD; `POST /api/admin/appointments` (secretary booking); `PATCH /api/admin/appointments/:id` (attendance, copay, cancel/reschedule)
- **Seed data**: 3–4 Specialties with 1–2 Doctors each, 4 health insurances with distinct copay amounts (Argentine realism: e.g. IOMA, PAMI, OSDE, Swiss Medical), one Admin account, one Secretary, one Doctor per specialty.
- **No account recovery or patient self-service beyond the one-time link.**

## Testing Decisions

- What makes a good test: assert external behavior (a booking is rejected because it exceeds the 3-per-DNI cap), never implementation details. Name tests in domain vocabulary.
- **Primary seam — service layer** (`server/src/services/`): all business rules are unit-tested with an in-memory fake of the query functions. Covers: instant booking rules, 3-appointment cap, cancellation window boundary, atomic reschedule, no-show auto-mark, one-time-link validity/expiry, slot computation from availability minus blocks.
- **Secondary seam — query layer** (`server/src/db/queries/`): integration tests against a local Postgres test database (initially local; migrate to a Neon test database later). Covers raw-SQL correctness and the rules that can only hold at the DB: the unique slot constraint, concurrent double-booking rejection, transactional reschedule.
- **Minor seam — API**: a small set of Supertest contract tests through the whole stack for the critical flows (book → confirm; cancel via link; reschedule via link; secretary books and records copay).
- **Client**: Vitest + React Testing Library for the booking form flow (validation, step navigation, slot picking); Puppeteer visual QA script capturing a screenshot of every view for manual review.
- **Prior art**: greenfield repo — no existing tests; the seams above are the first, following standard Vitest/Supertest conventions.

## Out of Scope

- Patient accounts, OTP/email verification, or any patient auth beyond the one-time link.
- Payments or payment-gateway integration (only copay recording).
- Multi-clinic / multi-branch support.
- Waitlist for fully-booked doctors.
- Doctors editing attendance or availability.
- Localization / i18n.
- Secretary notifications on new bookings.
- Admin metrics dashboard.
- CI/CD pipeline (deferred).
- Password reset / self-service for staff accounts.
- GDPR/PDPA compliance program (privacy is handled by design, not by a compliance suite).

## Further Notes

- Accessibility is a stated requirement (patients of all ages) — the public flow keeps large, legible UI and a short path; the front-desk and phone channels exist explicitly as the accessibility fallback.
- The confirmation screen is the immediate feedback for web bookings; email is the durable reference.
- Zod is assumed for shared domain schemas and server request validators (decision recorded in ARCHITECTURE.md); flat TS types + manual validation would not change the module layout.
- Exact seed data (specialties, doctors, health insurances, copay amounts) is finalized at implementation time.
- Deployment is Vercel (client + serverless functions) + Neon, both on free tiers; reminders and no-show marking run on GitHub Actions scheduled workflows (Vercel Cron's free tier caps cadence at once per day).
