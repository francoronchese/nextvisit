# Architecture Overview

Living document that equips agents with a rapid understanding of the codebase so they can navigate and contribute from day one. Update it as the codebase evolves.

## 1. Project Structure

pnpm workspace monorepo with three packages: `client`, `server`, and `shared`. Each is an independent package (own `package.json`), linked via `workspace:*` dependencies.

```
[Project Root]/
├── server/                      # All server-side code and APIs
│   ├── src/
│   │   ├── api/                 # Route definitions / API entry points
│   │   ├── controllers/         # Request handlers (parse req, call services, send res)
│   │   ├── services/            # Business logic and orchestration
│   │   ├── db/                  # Everything DB-related lives here (see section 1.3)
│   │   │   ├── schema.sql       # Table/column definitions (raw SQL DDL, no ORM)
│   │   │   ├── migrations/      # Raw SQL migration files, one per schema change
│   │   │   └── queries/         # Reusable query functions per table/domain (raw SQL)
│   │   ├── validators/          # Zod schemas for REQUEST-SPECIFIC payloads
│   │   │                        # (e.g. bookAppointmentSchema, loginSchema — endpoint-shaped,
│   │   │                        #  NOT domain entities. See rule in section 1.1.)
│   │   ├── middlewares/         # Admin auth guards, error handling, anti-spam rate limiting
│   │   └── utils/               # Backend-only utility functions + Email templates + sending via Resend
│   ├── config/                  # Backend configuration files
│   ├── tests/                   # Backend unit and integration tests
│   └── package.json
│
├── client/                      # All client-side code for user interfaces
│   ├── src/
│   │   ├── components/          # GLOBAL — reusable across the whole app (Button, Input, Layout...)
│   │   ├── pages/               # GLOBAL — route-level pages that compose multiple features
│   │   ├── hooks/               # GLOBAL — hooks used across features
│   │   ├── utils/               # GLOBAL — framework-agnostic helper functions
│   │   ├── services/            # GLOBAL — single HTTP client (apiClient.ts) used by all features directly
│   │   ├── features/            # FEATURE-FOLDER STRUCTURE (see section 1.2)
│   │   │   ├── booking/         # Patient self-service flow (no account: form, specialty, type, doctor, slot, confirmation)
│   │   │   │   ├── components/  # LOCAL to booking
│   │   │   │   ├── pages/       # LOCAL to booking
│   │   │   │   ├── hooks/       # LOCAL to booking
│   │   │   │   ├── booking.types.ts # feature-local types (re-exports/extends shared/)
│   │   │   │   └── index.ts     # PUBLIC entry point — the only import surface for this feature
│   │   │   ├── appointments/    # Cancel/reschedule via the one-time link
│   │   │   │   ├── components/  # LOCAL to appointments
│   │   │   │   ├── pages/       # LOCAL to appointments
│   │   │   │   ├── hooks/       # LOCAL to appointments
│   │   │   │   ├── appointments.types.ts # feature-local types
│   │   │   │   └── index.ts     # PUBLIC entry point
│   │   │   └── admin/           # Admin panel: login + secretary views + doctor views
│   │   │       ├── components/  # LOCAL to admin
│   │   │       ├── pages/       # LOCAL to admin
│   │   │       ├── hooks/       # LOCAL to admin
│   │   │       ├── admin.types.ts # feature-local types
│   │   │       └── index.ts     # PUBLIC entry point
│   │   └── main.tsx / App.tsx
│   ├── public/                  # Publicly accessible static assets
│   ├── tests/                   # Frontend unit, E2E, and Puppeteer visual QA
│   └── package.json
│
├── shared/                      # Cross-package code used by BOTH client and server
│   ├── src/
│   │   ├── types/               # Zod DOMAIN schemas + inferred types (e.g. patientSchema, appointmentSchema)
│   │   │                        # See rule in section 1.1 for what belongs here.
│   │   └── utils/               # Framework-agnostic utility functions
│   └── package.json
│
├── docs/                        # Project documentation (ADRs, setup guides)
├── scripts/                     # Automation (data seeding, Puppeteer visual QA)
├── pnpm-workspace.yaml          # Defines the three workspace packages: client, server, shared
├── .gitignore
├── README.md
└── ARCHITECTURE.md              # This document
```

### 1.1. Rule: where does a Zod schema live?

Ask: does this schema describe a **domain entity**, or a **single endpoint's payload**?

- **Domain entity** (Patient, Doctor, Appointment — the shape of something that exists in the DB and that both client and server need to know identically) → `shared/src/types/`. Export the schema AND the inferred type (`z.infer<typeof x>`) so both packages import one source of truth instead of duplicating interfaces.
- **Endpoint-specific payload** (`bookAppointmentSchema`, `loginSchema`, anything with custom validation messages, regexes, or a shape that only makes sense for one request) → stays in `server/src/validators/`. The client never needs this exact schema — it validates its own forms with its own UX rules.

When in doubt: if renaming the schema to match a noun in the database (Patient, not BookPayload) still makes sense, it's domain → shared. If the schema's name matches an action/endpoint (Book, Login, Reschedule), it's request-shaped → server.

**Carve-out — response composites.** A response body that assembles several domain entities and that the client consumes as one unit (e.g. `AppointmentDetail` = appointment + patient + doctor + specialty + appointmentType, or `BookingResponse` = patient + appointment) lives in `shared/src/types/` alongside the domain schemas it is built from. It is still a noun, still needs to be identical on both sides, and it is *composed of* domain schemas rather than duplicating their fields. Keep the *request* side (bookAppointment, reschedule, login) in `server/src/validators/`.

### 1.3. Rule: `server/db/schema.sql` vs `shared/types` — two different kinds of "schema"

These names collide but are NOT the same thing:

- `server/src/db/schema.sql` — raw SQL DDL: table/column definitions, indexes, foreign keys, DB-level constraints. Describes how the DATA IS STORED. Only the server needs this — the client never talks to the database directly.
- `shared/src/types/` — Zod schemas describing the SHAPE OF A DOMAIN ENTITY as it's exchanged over the API (e.g. what an Appointment looks like in a JSON response). Consumed by both client and server.

A single domain concept (e.g. Appointment) typically has BOTH: a table definition in `server/src/db/schema.sql` (DB layer) and a Zod schema + type in `shared/src/types/appointment.schema.ts` (API/domain layer). They usually have similar fields but are not required to be identical — e.g. the DB row might have internal columns (audit columns, status flags) that are never exposed through the API and therefore don't belong in the shared schema.

`server/src/db/queries/` holds functions that run raw SQL against the tables (e.g. `getAvailableSlotsForDoctor`, `insertAppointment`) — called by `services/`, not directly by controllers.

`server/src/db/migrations/` holds the raw SQL migration files, applied in order to evolve the schema.

### 1.2. Rule: feature-folder structure (client only)

- Anything at the top level of `client/src/` (outside `features/`) is GLOBAL — it can be used by any feature or page. This includes `components/`, `pages/`, `hooks/`, `utils/`, `services/`.
- Each feature folder under `client/src/features/[name]/` repeats the same folder names (`components/`, `pages/`, `hooks/`) — these are LOCAL to that feature only. E.g. `features/admin/components/` holds components used only within the admin panel.
- There is no separate top-level "shared" folder in the client — the root of `src/` already IS the global scope. (Do not confuse this with the root-level `shared/` package, which is cross-package between client and server.)
- Only the feature's `index.ts` (public entry point) should be imported from outside the feature. Everything inside `features/[name]/` is private to that feature.
- Features call the global HTTP client (`client/src/services/apiClient.ts`) directly from their hooks or components — there is no per-feature HTTP wrapper. The staff session token for the admin panel is injected here.
- Optionally enforce the public/private boundary with `eslint-plugin-project-structure` or `eslint-plugin-boundaries`.

## 2. High-Level System Diagram

```
                      +---------------------------------------------------+
                      |                   Next Visit                      |
                      |                                                   |
[Patient] <--------> [client: React SPA] <----> [server: REST API] <----> [Neon Postgres]
 (web, no account)   (Vercel)                   (Vercel Functions)         (raw SQL, pooled)
                      |                             ^    |
                      +-----------------------------+    |
                                   Resend (email)        |
                            (confirmation, reminder,     |
                              one-time link)             |
                      [GitHub Actions cron] -- 24h reminder --> server

[Secretary / Doctor / Admin] <----> [client: /admin panel] <----> [server] <----> [Neon Postgres]
```

## 3. Core Components

### 3.1. Client

- **Name**: Next Visit web app
- **Description**: Two surfaces — (1) public booking flow: patient fills DNI, name, last name, health insurance, phone, email → picks specialty → appointment type → doctor → slot → instant confirmation; cancel/reschedule via one-time link from email. (2) Admin panel behind a login: secretary loads doctor availability and records attendance/copays, doctor views their upcoming patients (read-only), admin manages staff credentials and health insurance/copay table.
- **Technologies**: React, Vite, Tailwind CSS, TypeScript
- **Deployment**: Vercel

### 3.2. Server

- **Name**: Next Visit API
- **Description**: Handles booking, cancellation/rescheduling via one-time link, slot generation, availability maintenance, attendance/copay recording, admin auth, and email sending. Stateless serverless functions.
- **Technologies**: Node.js, Express, TypeScript, raw SQL
- **Deployment**: Vercel Functions (serverless)

### 3.3. Shared

- **Description**: Cross-package Zod domain schemas, inferred TypeScript types, and framework-agnostic utilities consumed by both client and server via `workspace:*`.

## 4. Data Stores

### 4.1. Primary Database

- **Name**: Neon Postgres
- **Type**: PostgreSQL (serverless, connection pooling)
- **Purpose**: Single source of truth for all domain data
- **Key Tables**:
  - `specialties`, `doctors`, `appointment_types`, `doctor_appointment_types` — catalog: specialty → appointment types → the offering join of which types each doctor offers
  - `availabilities` (recurring weekly hours per doctor), `availability_blocks` (holiday/absence exceptions)
  - `patients` (DNI as identity anchor, name, last name, health insurance, phone, email)
  - `health_insurances` (obra social → copay amount)
  - `appointments` (patient, doctor, type, start time, duration, booking channel, status lifecycle, copay amount + paid flag, attendance)
  - `one_time_links` (authorization tokens for cancel/reschedule, single-use, expire with the appointment)
  - `users` (staff: admin, secretary, doctor — hashed passwords)
  - `booking_attempts` (anti-spam: rate limiting keyed by DNI)

No cache or queue. Reminders are driven by a scheduled GitHub Actions workflow querying upcoming appointments.

See `DATA-MODEL.md` for the full data model: entity purposes, a Mermaid ER diagram, critical constraints, the appointment lifecycle, RBAC, migrations, and seed data.

## 5. External Integrations / APIs

- **Service Name**: Resend
- **Purpose**: Transactional email — booking confirmation (with one-time link), 24h reminder, reschedule/cancellation notices. Sent whenever a patient provides an email, regardless of booking channel.
- **Integration Method**: REST API / SDK

## 6. Deployment & Infrastructure

- **Cloud Provider**: Vercel — client SPA + serverless functions
- **Database**: Neon (managed Postgres with connection pooling suited to serverless)
- **CI/CD**: not set up yet
- **Cron**: GitHub Actions scheduled workflows (hourly) for the 24h appointment reminders and the no-show auto-mark job; they hit `POST /api/reminders` and `POST /api/no-shows` with `REMINDERS_SECRET` as bearer token (ADR-0005)
- **Visual QA**: Puppeteer script capturing screenshots of each view for manual review
- **Monitoring & Logging**: Vercel logs (basic)

## 7. Security Considerations

- **No patient accounts**: the DNI is the identity anchor; the one-time link is the authorization to cancel/reschedule. Tokens are single-use and expire when the appointment passes.
- **Admin auth**: email + password (hashed), for admin/secretary/doctor surfaces only. Login attempts are rate-limited per email + IP (`MAX_LOGIN_ATTEMPTS` per 15 min, default 5).
- **RBAC**: admin (creates credentials, manages health insurance/copay table), secretary (availability, booking on behalf, attendance/copay), doctor (read-only own appointments).
- **Anti-spam**: maximum 3 active future appointments per DNI (all booking channels) + rate limit on booking attempts per DNI.
- **Data protection**: TLS in transit; PII (DNI, email, phone) protected and not exposed in responses beyond what's needed; secrets via Vercel environment variables.
- **Input validation**: Zod on every request payload.

## 8. Development & Testing Environment

- **Package Manager**: pnpm (workspace)
- **Local Setup**: `pnpm install`, configure env vars, run seed script, `pnpm dev`
- **Testing Frameworks**: Vitest + Supertest (server), Vitest + React Testing Library (client), Puppeteer (visual QA)
- **Code Quality Tools**: ESLint (+ optionally `eslint-plugin-project-structure` for feature-folder boundaries)

## 9. Future Considerations / Roadmap

- CI/CD pipeline (GitHub Actions: lint, typecheck, tests)
- Doctor marks attendance directly
- Waitlist when a doctor is fully booked
- Secretary notifications on new bookings
- Admin dashboard with metrics
- Localization (ES/EN)
- Patient self-service improvements within the no-account constraint

## 10. Project Identification

- **Project Name**: Next Visit
- **Primary Contact**: Franco Ronchese
- **Date of Last Update**: 2026-08-14
- **Repository**: [TBD]

## 11. Glossary / Acronyms

See `CONTEXT.md` for the domain glossary (Patient, DNI, Specialty, Doctor, Secretary, Admin, Appointment Type, Availability, Appointment, Booking Channel, No-show, Copay, Slot, One-time Link, Cancellation Window). ADRs in `docs/adr/` record the rationale behind key decisions.
