import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import type { User } from "@nextvisit/shared";
import type { StaffUserRow } from "../../src/db/queries/users";
import { createAuthService, type AuthQueries } from "../../src/services/auth";
import { InvalidCredentialsError } from "../../src/utils/invalidCredentialsError";

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
    await expect(service.login("nobody@nextvisit.ar", PASSWORD)).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
  });

  it("rejects a wrong password", async () => {
    const service = createAuthService(buildFakeQueries());
    await expect(service.login(staffRow.email, "wrong-password")).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
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