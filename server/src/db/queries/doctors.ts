import type { Doctor } from "@nextvisit/shared";
import type { QueryExecutor } from "../client";
import { query, queryOne } from "../client";

export const DOCTOR_COLUMNS = `id, specialty_id AS "specialtyId", first_name AS "firstName", last_name AS "lastName"`;

export function getDoctorByIdVia(executor: QueryExecutor, id: string): Promise<Doctor | undefined> {
  return executor.queryOne<Doctor>(`SELECT ${DOCTOR_COLUMNS} FROM doctors WHERE id = $1`, [id]);
}

export async function listAllDoctors(): Promise<Doctor[]> {
  return query<Doctor>(`SELECT ${DOCTOR_COLUMNS} FROM doctors ORDER BY last_name, first_name`);
}

export async function getDoctorById(id: string): Promise<Doctor | undefined> {
  return queryOne<Doctor>(`SELECT ${DOCTOR_COLUMNS} FROM doctors WHERE id = $1`, [id]);
}