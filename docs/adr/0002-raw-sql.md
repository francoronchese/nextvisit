# Raw SQL Instead of an ORM

The server accesses Postgres through handwritten SQL — a schema.sql DDL file, raw SQL migrations, and per-domain query functions — rather than an ORM like Drizzle or Prisma. Keeps full control over queries and avoids a heavy dependency in a serverless context; the cost is writing queries by hand with no schema-to-type generation.
