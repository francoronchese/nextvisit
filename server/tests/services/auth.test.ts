import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it } from "vitest";
import type { User } from "@nextvisit/shared";
import type { StaffUserRow } from "../../src/db/queries/users";
import {
  createAuthService,
  DEFAULT_MAX_LOGIN_ATTEMPTS,
  enforceLoginRateLimit,
  type AuthQueries,
} from "../../src/services/auth";

const PASSWORD = "secret123";

const staffRow: StaffUserRow = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  email: "admin@nextvisit.ar",
  passwordHash: bcrypt.hashSync(PASSWORD, 4),
  role: "admin",
  doctorId: null,
  createdAt: "2026-08-15T00:00:00.000Z",
};

const expectedUser: User = {
  id: staffRow.id,
  email: staffRow.email,
  role: staffRow.role,
  createdAt: staffRow.createdAt,
};

function buildFakeQueries(overrides: Partial<AuthQueries> = {}): AuthQueries {
  return {
    getUserByEmail: (email) =>
      Promise.resolve(email === staffRow.email ? staffRow : undefined),
    getUserById: (id) => Promise.resolve(id === staffRow.id ? expectedUser : undefined),
    ...overrides,
  };
}

describe("auth service", () => {
  it("logs in a staff member with valid credentials and returns a token", async () => {
    const service = createAuthService(buildFakeQueries());
    const result = await service.login(staffRow.email, PASSWORD);
    expect(result.user).toEqual(expectedUser);
    expect(result.token).toBeTruthy();
  });

  it("rejects an unknown email", async () => {
    const service = createAuthService(buildFakeQueries());
    await expect(service.login("nobody@nextvisit.ar", PASSWORD)).rejects.toMatchObject({
      status: 401,
    });
  });

  it("rejects a wrong password", async () => {
    const service = createAuthService(buildFakeQueries());
    await expect(service.login(staffRow.email, "wrong-password")).rejects.toMatchObject({
      status: 401,
    });
  });

  it("never reveals whether the email or the password was wrong", async () => {
    const service = createAuthService(buildFakeQueries());
    const unknownEmail = await service.login("nobody@nextvisit.ar", "whatever").then(
      () => null,
      (error: unknown) => error
    );
    const wrongPassword = await service.login(staffRow.email, "whatever").then(
      () => null,
      (error: unknown) => error
    );
    expect(unknownEmail).toEqual(wrongPassword);
  });

  it("normalizes the email before looking the user up", async () => {
    let queriedEmail = "";
    const service = createAuthService(
      buildFakeQueries({
        getUserByEmail: (email) => {
          queriedEmail = email;
          return Promise.resolve(staffRow);
        },
      })
    );
    await service.login("  Admin@NextVisit.AR  ", PASSWORD);
    expect(queriedEmail).toBe("admin@nextvisit.ar");
  });

  it("authenticates a valid token back to the user", async () => {
    const service = createAuthService(buildFakeQueries());
    const { token } = await service.login(staffRow.email, PASSWORD);
    await expect(service.authenticate(token)).resolves.toEqual(expectedUser);
  });

  it("rejects an invalid token", async () => {
    const service = createAuthService(buildFakeQueries());
    await expect(service.authenticate("not-a-token")).resolves.toBeUndefined();
  });

  it("rejects a token for a user that no longer exists", async () => {
    const service = createAuthService(buildFakeQueries());
    const { token } = await service.login(staffRow.email, PASSWORD);
    const noUser = createAuthService(
      buildFakeQueries({ getUserById: () => Promise.resolve(undefined) })
    );
    await expect(noUser.authenticate(token)).resolves.toBeUndefined();
  });
});

describe("login rate limit", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");

  function buildAttemptQueries(count: number) {
    let attempts = count;
    return {
      recordLoginAttempt: () => {
        attempts += 1;
        return Promise.resolve();
      },
      countRecentLoginAttempts: () => Promise.resolve(attempts),
    };
  }

  afterEach(() => {
    delete process.env.MAX_LOGIN_ATTEMPTS;
  });

  it("allows logins while the attempt count stays within the cap", async () => {
    const queries = buildAttemptQueries(DEFAULT_MAX_LOGIN_ATTEMPTS - 1);
    await expect(
      enforceLoginRateLimit(queries, "admin@nextvisit.ar", "10.0.0.9", now)
    ).resolves.toBeUndefined();
  });

  it("rejects the login once the cap is exceeded", async () => {
    const queries = buildAttemptQueries(DEFAULT_MAX_LOGIN_ATTEMPTS + 1);
    await expect(
      enforceLoginRateLimit(queries, "admin@nextvisit.ar", "10.0.0.9", now)
    ).rejects.toMatchObject({ status: 429 });
  });

  it("honours a MAX_LOGIN_ATTEMPTS override", async () => {
    process.env.MAX_LOGIN_ATTEMPTS = "2";
    const queries = buildAttemptQueries(3);
    await expect(
      enforceLoginRateLimit(queries, "admin@nextvisit.ar", "10.0.0.9", now)
    ).rejects.toMatchObject({ status: 429 });
  });

  it("normalizes the email before counting attempts", async () => {
    let recordedEmail = "";
    const queries = {
      recordLoginAttempt: (email: string) => {
        recordedEmail = email;
        return Promise.resolve();
      },
      countRecentLoginAttempts: () => Promise.resolve(0),
    };
    await enforceLoginRateLimit(queries, "  Admin@NextVisit.AR  ", "10.0.0.9", now);
    expect(recordedEmail).toBe("admin@nextvisit.ar");
  });
});