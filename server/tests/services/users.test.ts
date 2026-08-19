import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import type { User } from "@nextvisit/shared";
import { createUsersService, type UsersQueries } from "../../src/services/users";

const email = "secretary@nextvisit.ar";
const password = "secret123";

const secretaryUser: User = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  email,
  role: "secretary",
  createdAt: "2026-08-15T00:00:00.000Z",
};

const doctorRow = { id: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16" };

function buildQueries(overrides: Partial<UsersQueries> = {}) {
  const insertUser = vi.fn<UsersQueries["insertUser"]>((input) =>
    Promise.resolve<User>({
      id: secretaryUser.id,
      email: input.email,
      role: input.role,
      createdAt: secretaryUser.createdAt,
      ...(input.doctorId ? { doctorId: input.doctorId } : {}),
    })
  );
  const listUsers = vi.fn<UsersQueries["listUsers"]>(() => Promise.resolve([secretaryUser]));
  const getDoctorById = vi.fn<UsersQueries["getDoctorById"]>((id) =>
    Promise.resolve(id === doctorRow.id ? doctorRow : undefined)
  );
  return {
    queries: { insertUser, listUsers, getDoctorById, ...overrides },
    insertUser,
    listUsers,
    getDoctorById,
  };
}

describe("users service", () => {
  it("creates a secretary user and stores a bcrypt hash, not the password", async () => {
    const { queries, insertUser } = buildQueries();
    const service = createUsersService(queries);

    const user = await service.createUser({ email, password, role: "secretary" });

    expect(user).toEqual(secretaryUser);
    expect(insertUser).toHaveBeenCalledTimes(1);
    const input = insertUser.mock.calls[0]![0];
    expect(input).toMatchObject({ email, role: "secretary", doctorId: null });
    expect(input.passwordHash).not.toBe(password);
    await expect(bcrypt.compare(password, input.passwordHash)).resolves.toBe(true);
  });

  it("creates a doctor user linked to its doctor record", async () => {
    const { queries, getDoctorById } = buildQueries();
    const service = createUsersService(queries);

    const user = await service.createUser({
      email: "doctor@nextvisit.ar",
      password,
      role: "doctor",
      doctorId: doctorRow.id,
    });

    expect(user).toMatchObject({ role: "doctor", doctorId: doctorRow.id });
    expect(getDoctorById).toHaveBeenCalledWith(doctorRow.id);
  });

  it("rejects a doctor user whose doctor record does not exist", async () => {
    const { queries, insertUser } = buildQueries();
    const service = createUsersService(queries);

    await expect(
      service.createUser({
        email: "ghost@nextvisit.ar",
        password,
        role: "doctor",
        doctorId: "00000000-0000-0000-0000-000000000000",
      })
    ).rejects.toMatchObject({ status: 404, message: "doctor not found" });
    expect(insertUser).not.toHaveBeenCalled();
  });

  it("rejects a duplicate email as a 409", async () => {
    const { queries } = buildQueries({
      insertUser: vi.fn(() => Promise.reject({ code: "23505" })),
    });
    const service = createUsersService(queries);

    await expect(
      service.createUser({ email, password, role: "secretary" })
    ).rejects.toMatchObject({ status: 409, message: "a user with that email already exists" });
  });

  it("stores the email lowercase so login always matches", async () => {
    const { queries, insertUser } = buildQueries();
    const service = createUsersService(queries);

    await service.createUser({ email: "Admin@NextVisit.AR", password, role: "secretary" });

    expect(insertUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "admin@nextvisit.ar" })
    );
  });

  it("lists all staff users", async () => {
    const { queries, listUsers } = buildQueries();
    const service = createUsersService(queries);

    await expect(service.listUsers()).resolves.toEqual([secretaryUser]);
    expect(listUsers).toHaveBeenCalledTimes(1);
  });
});
