# Serverless on Vercel with Neon Postgres

The client and the server both deploy to Vercel as serverless functions, and the database is Neon Postgres with connection pooling. Avoids running a persistent server and costs nothing at portfolio scale; the cost is a stateless design where connections are per request and in-memory state is unavailable.
