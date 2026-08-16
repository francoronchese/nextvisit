import type { User } from "@nextvisit/shared";
import { queryOne } from "../client";
import { utcIso } from "../sql";

export type StaffUserRow = {
  id: string;
  email: string;
  passwordHash: string;
  role: User["role"];
  doctorId: string | null;
  createdAt: string;
};

const USER_COLUMNS = `id, email, role, doctor_id AS "doctorId",
  ${utcIso("created_at")} AS "createdAt"`;

export async function getUserByEmail(email: string): Promise<StaffUserRow | undefined> {
  return queryOne<StaffUserRow>(
    `SELECT ${USER_COLUMNS}, password_hash AS "passwordHash"
     FROM users
     WHERE email = $1`,
    [email]
  );
}

export async function getUserById(id: string): Promise<User | undefined> {
  const row = await queryOne<Omit<StaffUserRow, "passwordHash">>(
    `SELECT ${USER_COLUMNS}
     FROM users
     WHERE id = $1`,
    [id]
  );
  if (!row) return undefined;
  return toPublicUser(row);
}

export function toPublicUser(row: Omit<StaffUserRow, "passwordHash">): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt,
    ...(row.doctorId ? { doctorId: row.doctorId } : {}),
  };
}