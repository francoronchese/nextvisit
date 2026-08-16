import bcrypt from "bcryptjs";
import type { User } from "@nextvisit/shared";
import type { StaffUserRow } from "../db/queries/users";
import { getUserByEmail, getUserById, toPublicUser } from "../db/queries/users";
import { invalidCredentialsError } from "../utils/httpErrors";
import { signSessionToken, verifySessionToken } from "../utils/sessionToken";

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