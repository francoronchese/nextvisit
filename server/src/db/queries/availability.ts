import type { Availability, AvailabilityBlock, Doctor } from "@nextvisit/shared";
import { query, queryOne } from "../client";

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
  reason?: string;
};

export const AVAILABILITY_COLUMNS = `id, doctor_id AS "doctorId", weekday,
  to_char(start_time, 'HH24:MI') AS "startTime",
  to_char(end_time, 'HH24:MI') AS "endTime"`;

export const AVAILABILITY_BLOCK_COLUMNS = `id, doctor_id AS "doctorId",
  to_char(date, 'YYYY-MM-DD') AS "date",
  to_char(start_time, 'HH24:MI') AS "startTime",
  to_char(end_time, 'HH24:MI') AS "endTime", reason`;

export type AvailabilityQueries = {
  listAllDoctors(): Promise<Doctor[]>;
  getDoctorById(id: string): Promise<Doctor | undefined>;
  listAvailabilityForDoctor(doctorId: string): Promise<Availability[]>;
  getAvailabilityById(id: string): Promise<Availability | undefined>;
  createAvailability(input: AvailabilityInput): Promise<Availability>;
  updateAvailability(id: string, input: AvailabilityInput): Promise<Availability | undefined>;
  deleteAvailability(id: string): Promise<boolean>;
  listAvailabilityBlocksForDoctor(doctorId: string): Promise<AvailabilityBlock[]>;
  getAvailabilityBlockById(id: string): Promise<AvailabilityBlock | undefined>;
  createAvailabilityBlock(input: AvailabilityBlockInput): Promise<AvailabilityBlock>;
  deleteAvailabilityBlock(id: string): Promise<boolean>;
};

export const availabilityQueries: AvailabilityQueries = {
  async listAllDoctors() {
    return query<Doctor>(
      `SELECT id, specialty_id AS "specialtyId", first_name AS "firstName", last_name AS "lastName"
       FROM doctors
       ORDER BY last_name, first_name`
    );
  },

  async getDoctorById(id) {
    return queryOne<Doctor>(
      `SELECT id, specialty_id AS "specialtyId", first_name AS "firstName", last_name AS "lastName"
       FROM doctors
       WHERE id = $1`,
      [id]
    );
  },

  async listAvailabilityForDoctor(doctorId) {
    return query<Availability>(
      `SELECT ${AVAILABILITY_COLUMNS}
       FROM availabilities
       WHERE doctor_id = $1
       ORDER BY weekday, start_time`,
      [doctorId]
    );
  },

  async getAvailabilityById(id) {
    return queryOne<Availability>(`SELECT ${AVAILABILITY_COLUMNS} FROM availabilities WHERE id = $1`, [id]);
  },

  async createAvailability(input) {
    const availability = await queryOne<Availability>(
      `INSERT INTO availabilities (doctor_id, weekday, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       RETURNING ${AVAILABILITY_COLUMNS}`,
      [input.doctorId, input.weekday, input.startTime, input.endTime]
    );
    if (!availability) throw new Error("failed to create availability");
    return availability;
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

  async listAvailabilityBlocksForDoctor(doctorId) {
    return query<AvailabilityBlock>(
      `SELECT ${AVAILABILITY_BLOCK_COLUMNS}
       FROM availability_blocks
       WHERE doctor_id = $1
       ORDER BY date DESC, start_time`,
      [doctorId]
    );
  },

  async getAvailabilityBlockById(id) {
    return queryOne<AvailabilityBlock>(
      `SELECT ${AVAILABILITY_BLOCK_COLUMNS} FROM availability_blocks WHERE id = $1`,
      [id]
    );
  },

  async createAvailabilityBlock(input) {
    const block = await queryOne<AvailabilityBlock>(
      `INSERT INTO availability_blocks (doctor_id, date, start_time, end_time, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${AVAILABILITY_BLOCK_COLUMNS}`,
      [input.doctorId, input.date, input.startTime, input.endTime, input.reason ?? null]
    );
    if (!block) throw new Error("failed to create availability block");
    return block;
  },

  async deleteAvailabilityBlock(id) {
    const result = await query<{ deleted: number }>(
      `DELETE FROM availability_blocks WHERE id = $1 RETURNING 1 AS deleted`,
      [id]
    );
    return result.length > 0;
  },
};