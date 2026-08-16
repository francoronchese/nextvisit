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

export function getAuthTokenSecret(): string {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret) {
    throw new Error("AUTH_TOKEN_SECRET is not set (see .env.example at the repo root)");
  }
  return secret;
}