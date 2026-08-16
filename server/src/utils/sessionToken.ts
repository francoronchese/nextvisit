import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@nextvisit/shared";
import { getAuthTokenSecret } from "../../config/env";

const TOKEN_TTL_SECONDS = 60 * 60 * 24;

export type SessionClaims = {
  sub: string;
  role: UserRole;
  exp: number;
};

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function signSessionToken(userId: string, role: UserRole): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({ sub: userId, role, exp: now + TOKEN_TTL_SECONDS }));
  const signature = createHmac("sha256", getAuthTokenSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): SessionClaims | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }
  const expected = createHmac("sha256", getAuthTokenSecret()).update(payload).digest();
  const provided = Buffer.from(signature, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaims;
    if (claims.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}