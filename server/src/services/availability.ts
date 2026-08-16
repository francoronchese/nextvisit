import type { Availability, AvailabilityBlock, Doctor } from "@nextvisit/shared";
import {
  availabilityQueries,
  type AvailabilityBlockInput,
  type AvailabilityInput,
  type AvailabilityQueries,
} from "../db/queries/availability";
import { notFoundError } from "../utils/httpErrors";

export type AvailabilityService = {
  listDoctors(): Promise<Doctor[]>;
  listAvailabilityForDoctor(doctorId: string): Promise<Availability[]>;
  createAvailability(input: AvailabilityInput): Promise<Availability>;
  updateAvailability(id: string, input: AvailabilityInput): Promise<Availability>;
  deleteAvailability(id: string): Promise<void>;
  listBlocksForDoctor(doctorId: string): Promise<AvailabilityBlock[]>;
  createBlock(input: AvailabilityBlockInput): Promise<AvailabilityBlock>;
  deleteBlock(id: string): Promise<void>;
};

async function ensureDoctorExists(queries: AvailabilityQueries, doctorId: string): Promise<void> {
  const doctor = await queries.getDoctorById(doctorId);
  if (!doctor) {
    throw notFoundError("doctor");
  }
}

export function createAvailabilityService(queries: AvailabilityQueries): AvailabilityService {
  return {
    listDoctors() {
      return queries.listAllDoctors();
    },

    async listAvailabilityForDoctor(doctorId) {
      await ensureDoctorExists(queries, doctorId);
      return queries.listAvailabilityForDoctor(doctorId);
    },

    async createAvailability(input) {
      await ensureDoctorExists(queries, input.doctorId);
      return queries.createAvailability(input);
    },

    async updateAvailability(id, input) {
      await ensureDoctorExists(queries, input.doctorId);
      const updated = await queries.updateAvailability(id, input);
      if (!updated) {
        throw notFoundError("availability");
      }
      return updated;
    },

    async deleteAvailability(id) {
      const deleted = await queries.deleteAvailability(id);
      if (!deleted) {
        throw notFoundError("availability");
      }
    },

    async listBlocksForDoctor(doctorId) {
      await ensureDoctorExists(queries, doctorId);
      return queries.listAvailabilityBlocksForDoctor(doctorId);
    },

    async createBlock(input) {
      await ensureDoctorExists(queries, input.doctorId);
      return queries.createAvailabilityBlock(input);
    },

    async deleteBlock(id) {
      const deleted = await queries.deleteAvailabilityBlock(id);
      if (!deleted) {
        throw notFoundError("availability block");
      }
    },
  };
}

export const availabilityService = createAvailabilityService(availabilityQueries);