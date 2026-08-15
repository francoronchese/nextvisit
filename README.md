# Next Visit

Booking medical appointments in a single clinic. Patients book, cancel, and reschedule online without an account; staff manage availability, attendance, and copays. See `ARCHITECTURE.md` for the codebase layout and `DATA-MODEL.md` for the database.

## Prerequisites

- Node.js and pnpm (`corepack enable` or install pnpm directly)
- PostgreSQL running locally

## Local Setup

The `server` connects to a local Postgres using the role and databases named in `.env`. Create them first, choosing your own dev password:

```bash
psql -U postgres

CREATE ROLE nextvisit WITH LOGIN PASSWORD 'your-dev-password';
CREATE DATABASE nextvisit OWNER nextvisit;
CREATE DATABASE nextvisit_test OWNER nextvisit;
\q
```

Then configure and install — use the same password in `.env`:

```bash
cp .env.example .env   # replace CHANGE_ME with the password you chose above
pnpm install
```

Create the schema and seed the data (idempotent — safe to re-run):

```bash
pnpm db:migrate
pnpm db:seed
```

Run the app:

```bash
pnpm dev               # Vite client on :5173 + Express API on :3000
```

## Tests

```bash
pnpm test              # all packages
pnpm --filter @nextvisit/server test   # integration tests need TEST_DATABASE_URL
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run client and server in watch mode |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm test` | Run all tests |
| `pnpm db:migrate` | Apply pending migrations to the dev database |
| `pnpm db:seed` | Seed specialties, doctors, insurances, and staff users |