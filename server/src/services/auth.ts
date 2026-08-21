import bcrypt from "bcryptjs";
import type { User } from "@nextvisit/shared";
import type { StaffUserRow } from "../db/queries/users";
import type { LoginAttemptQueries } from "../db/queries/loginAttempts";
import { getUserByEmail, getUserById, toPublicUser } from "../db/queries/users";
import { invalidCredentialsError, loginRateLimitedError } from "../utils/httpErrors";
import { signSessionToken, verifySessionToken } from "../utils/sessionToken";

export const DEFAULT_MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function configuredMaxLoginAttempts(): number {
  const parsed = Number(process.env.MAX_LOGIN_ATTEMPTS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_LOGIN_ATTEMPTS;
}

export type AuthQueries = {
  getUserByEmail(email: string): Promise<StaffUserRow | undefined>;
  getUserById(id: string): Promise<User | undefined>;
};

export type LoginResult = {
  token: string;
  user: User;
};

export type AuthService = {
  login(email: string, password: string): Promise<LoginResult>;
  authenticate(token: string): Promise<User | undefined>;
};

let dummyPasswordHash: string | undefined;

// Mirrors the booking rate limit (services/bookings.ts): the attempt is
// recorded before it is judged, so failed logins accumulate even when they are
// rejected. Keyed on email + IP, so one attacker cannot lock out a colleague.
export async function enforceLoginRateLimit(
  queries: Pick<LoginAttemptQueries, "recordLoginAttempt" | "countRecentLoginAttempts">,
  email: string,
  ip: string,
  now: Date
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  await queries.recordLoginAttempt(normalizedEmail, ip);
  const since = new Date(now.getTime() - LOGIN_ATTEMPT_WINDOW_MS).toISOString();
  const attempts = await queries.countRecentLoginAttempts(normalizedEmail, ip, since);
  if (attempts > configuredMaxLoginAttempts()) {
    throw loginRateLimitedError();
  }
}

async function compareAgainstKnownHash(
  password: string,
  passwordHash: string | undefined
): Promise<boolean> {
  if (passwordHash) {
    return bcrypt.compare(password, passwordHash);
  }
  // Compare against a dummy hash so an unknown email takes as long as a wrong
  // password, hiding whether the email exists.
  dummyPasswordHash ??= await bcrypt.hash("unknown-email-timing", 10);
  return bcrypt.compare(password, dummyPasswordHash);
}

export function createAuthService(queries: AuthQueries): AuthService {
  return {
    async login(email, password) {
      const normalizedEmail = email.trim().toLowerCase();
      const staff = await queries.getUserByEmail(normalizedEmail);
      const passwordMatches = await compareAgainstKnownHash(password, staff?.passwordHash);
      if (!staff || !passwordMatches) {
        throw invalidCredentialsError();
      }
      return {
        token: signSessionToken(staff.id, staff.role),
        user: toPublicUser(staff),
      };
    },
    async authenticate(token) {
      const claims = verifySessionToken(token);
      if (!claims) {
        return undefined;
      }
      return queries.getUserById(claims.sub);
    },
  };
}

export const authService = createAuthService({
  getUserByEmail,
  getUserById,
});