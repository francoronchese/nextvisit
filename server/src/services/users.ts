import bcrypt from "bcryptjs";
import type { StaffRole, User } from "@nextvisit/shared";
import { getDoctorById } from "../db/queries/doctors";
import { insertUser, listUsers } from "../db/queries/users";
import { emailTakenError, notFoundError } from "../utils/httpErrors";
import { isConstraintViolation } from "../utils/isConstraintViolation";

export type CreateUserInput = {
  email: string;
  password: string;
  role: StaffRole;
  doctorId?: string;
};

export type UsersQueries = {
  insertUser(input: {
    email: string;
    passwordHash: string;
    role: User["role"];
    doctorId: string | null;
  }): Promise<User>;
  listUsers(): Promise<User[]>;
  getDoctorById(id: string): Promise<{ id: string } | undefined>;
};

export type UsersService = {
  createUser(input: CreateUserInput): Promise<User>;
  listUsers(): Promise<User[]>;
};

// Cost factor for credentials the admin issues to real staff. Higher than the
// seed's dev cost because these passwords protect production logins.
const PASSWORD_HASH_ROUNDS = 10;

export function createUsersService(queries: UsersQueries): UsersService {
  return {
    async createUser(input) {
      if (input.doctorId) {
        const doctor = await queries.getDoctorById(input.doctorId);
        if (!doctor) {
          throw notFoundError("doctor");
        }
      }
      const passwordHash = await bcrypt.hash(input.password, PASSWORD_HASH_ROUNDS);
      try {
        return await queries.insertUser({
          // Stored lowercase so login (which lowercases too) always matches.
          email: input.email.trim().toLowerCase(),
          passwordHash,
          role: input.role,
          doctorId: input.doctorId ?? null,
        });
      } catch (error) {
        // The DB unique index on users.email is the authority: the rejection
        // holds even when two admins race to create the same account.
        if (isConstraintViolation(error)) {
          throw emailTakenError();
        }
        throw error;
      }
    },
    listUsers() {
      return queries.listUsers();
    },
  };
}

export const usersService = createUsersService({
  insertUser,
  listUsers,
  getDoctorById,
});
