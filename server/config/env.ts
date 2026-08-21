import { config } from "dotenv";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));

config({ path: `${here}/../../.env` });

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (see .env.example at the repo root)");
  }
  return url;
}

export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set (see .env.example at the repo root)");
  }
  return url;
}

// A weak secret lets anyone forge admin session tokens (HMAC-SHA256 over a
// predictable payload), so production refuses anything under 32 characters.
export function getAuthTokenSecret(): string {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) {
    throw new Error("AUTH_TOKEN_SECRET is not set (see .env.example at the repo root)");
  }
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("AUTH_TOKEN_SECRET is too weak for production (use at least 32 random characters)");
  }
  return secret;
}

// The GitHub Actions scheduled workflows (reminders, no-show auto-mark —
// ADR-0005) send the request with `Authorization: Bearer $REMINDERS_SECRET`.
// Optional locally: when unset, the scheduler routes refuse requests (fails closed).
export function getSchedulerSecret(): string | undefined {
  return process.env.REMINDERS_SECRET;
}