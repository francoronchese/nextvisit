import type { Availability, AvailabilityBlock, BlockReason, Doctor } from "@nextvisit/shared";
import { query, queryOne, requireRow, type QueryExecutor } from "../client";
import { getDoctorById, listAllDoctors } from "./doctors";

export type AvailabilityInput = {
  doctorId: string;
  weekday: number;
  startTime: string;
  endTime: string;
};

export type AvailabilityBlockInput = {
  doctorId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: BlockReason;
};

export const AVAILABILITY_COLUMNS = `id, doctor_id AS "doctorId", weekday,
  to_char(start_time, 'HH24:MI') AS "startTime",
  to_char(end_time, 'HH24:MI') AS "endTime"`;

export const AVAILABILITY_BLOCK_COLUMNS = `id, doctor_id AS "doctorId",
  to_char(date, 'YYYY-MM-DD') AS "date",
  to_char(start_time, 'HH24:MI') AS "startTime",
  to_char(end_time, 'HH24:MI') AS "endTime", reason`;

// The slot source (slots.ts) and the admin availability queries both need these
// lists, so they are executor-bound: the caller decides between the pool and a
// transaction snapshot.
export function listAvailabilityForDoctorVia(
  executor: QueryExecutor,
  doctorId: string
): Promise<Availability[]> {
  return executor.query<Availability>(
    `SELECT ${AVAILABILITY_COLUMNS}
     FROM availabilities
     WHERE doctor_id = $1
     ORDER BY weekday, start_time`,
    [doctorId]
  );
}

export function listAvailabilityBlocksForDoctorVia(
  executor: QueryExecutor,
  doctorId: string,
  fromDate?: string,
  toDate?: string
): Promise<AvailabilityBlock[]> {
  if (fromDate && toDate) {
    return executor.query<AvailabilityBlock>(
      `SELECT ${AVAILABILITY_BLOCK_COLUMNS}
       FROM availability_blocks
       WHERE doctor_id = $1 AND date >= $2 AND date <= $3
       ORDER BY date, start_time`,
      [doctorId, fromDate, toDate]
    );
  }
  return executor.query<AvailabilityBlock>(
    `SELECT ${AVAILABILITY_BLOCK_COLUMNS}
     FROM availability_blocks
     WHERE doctor_id = $1
     ORDER BY date DESC, start_time`,
    [doctorId]
  );
}

export type AvailabilityQueries = {
  listAllDoctors(): Promise<Doctor[]>;
  getDoctorById(id: string): Promise<Doctor | undefined>;
  listAvailabilityForDoctor(doctorId: string): Promise<Availability[]>;
  createAvailability(input: AvailabilityInput): Promise<Availability>;
  updateAvailability(id: string, input: AvailabilityInput): Promise<Availability | undefined>;
  deleteAvailability(id: string): Promise<boolean>;
  listAvailabilityBlocksForDoctor(doctorId: string): Promise<AvailabilityBlock[]>;
  createAvailabilityBlock(input: AvailabilityBlockInput): Promise<AvailabilityBlock>;
  deleteAvailabilityBlock(id: string): Promise<boolean>;
};

export const availabilityQueries: AvailabilityQueries = {
  listAllDoctors,
  getDoctorById,

  listAvailabilityForDoctor(doctorId) {
    return listAvailabilityForDoctorVia({ query, queryOne }, doctorId);
  },

  async createAvailability(input) {
    return requireRow(
      await queryOne<Availability>(
        `INSERT INTO availabilities (doctor_id, weekday, start_time, end_time)
         VALUES ($1, $2, $3, $4)
         RETURNING ${AVAILABILITY_COLUMNS}`,
        [input.doctorId, input.weekday, input.startTime, input.endTime]
      ),
      "create availability"
    );
  },

  async updateAvailability(id, input) {
    return queryOne<Availability>(
      `UPDATE availabilities
       SET doctor_id = $2, weekday = $3, start_time = $4, end_time = $5
       WHERE id = $1
       RETURNING ${AVAILABILITY_COLUMNS}`,
      [id, input.doctorId, input.weekday, input.startTime, input.endTime]
    );
  },

  async deleteAvailability(id) {
    const result = await query<{ deleted: number }>(
      `DELETE FROM availabilities WHERE id = $1 RETURNING 1 AS deleted`,
      [id]
    );
    return result.length > 0;
  },

  listAvailabilityBlocksForDoctor(doctorId) {
    return listAvailabilityBlocksForDoctorVia({ query, queryOne }, doctorId);
  },

  async createAvailabilityBlock(input) {
    return requireRow(
      await queryOne<AvailabilityBlock>(
        `INSERT INTO availability_blocks (doctor_id, date, start_time, end_time, reason)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${AVAILABILITY_BLOCK_COLUMNS}`,
        [input.doctorId, input.date, input.startTime, input.endTime, input.reason]
      ),
      "create availability block"
    );
  },

  async deleteAvailabilityBlock(id) {
    const result = await query<{ deleted: number }>(
      `DELETE FROM availability_blocks WHERE id = $1 RETURNING 1 AS deleted`,
      [id]
    );
    return result.length > 0;
  },
};