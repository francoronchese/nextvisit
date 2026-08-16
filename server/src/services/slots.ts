import type { AppointmentType, Availability, AvailabilityBlock, Doctor, Slot } from "@nextvisit/shared";
import { parseDateParts } from "@nextvisit/shared";
import { getAppointmentTypeById } from "../db/queries/catalog";
import {
  getDoctorById,
  getDoctorOffersType,
  listAvailabilityBlocksForDoctor,
  listAvailabilityForDoctor,
  listBookedAppointmentsForDoctor,
  type BookedAppointment,
} from "../db/queries/slots";
import { clinicLocalToUtc, utcToClinicParts } from "../utils/clinicTimezone";
import { NotFoundError } from "../utils/notFoundError";
import { timeToMinutes } from "../utils/time";

export type { BookedAppointment };

export type SlotQueries = {
  getDoctorById(id: string): Promise<Doctor | undefined>;
  getAppointmentTypeById(id: string): Promise<AppointmentType | undefined>;
  getDoctorOffersType(doctorId: string, typeId: string): Promise<boolean>;
  listAvailabilityForDoctor(doctorId: string): Promise<Availability[]>;
  listAvailabilityBlocksForDoctor(
    doctorId: string,
    fromDate: string,
    toDate: string
  ): Promise<AvailabilityBlock[]>;
  listBookedAppointmentsForDoctor(
    doctorId: string,
    fromInstant: Date,
    toInstant: Date
  ): Promise<BookedAppointment[]>;
};

export type AvailableSlot = {
  slot: Slot;
  durationMinutes: number;
};

export type SlotsService = {
  getSlotsForDoctor(
    doctorId: string,
    typeId: string,
    rangeStart?: string,
    options?: { rangeDays?: number; now?: Date }
  ): Promise<Slot[]>;
  getAvailableSlot(
    doctorId: string,
    typeId: string,
    date: string,
    startTime: string,
    now: Date
  ): Promise<AvailableSlot | undefined>;
};

function fromMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function addDays(date: string, days: number): string {
  const { year, month, day } = parseDateParts(date);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

function isoWeekday(date: string): number {
  const { year, month, day } = parseDateParts(date);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

function computeSlots(args: {
  availability: Availability[];
  blocks: AvailabilityBlock[];
  booked: BookedAppointment[];
  durationMinutes: number;
  rangeStart: string;
  rangeDays: number;
  now: Date;
}): Slot[] {
  const { availability, blocks, booked, durationMinutes, rangeStart, rangeDays, now } = args;
  const slots: Slot[] = [];
  const nowMs = now.getTime();

  for (let offset = 0; offset < rangeDays; offset += 1) {
    const date = addDays(rangeStart, offset);
    const weekday = isoWeekday(date);

    for (const window of availability.filter((a) => a.weekday === weekday)) {
      const windowStart = timeToMinutes(window.startTime);
      const windowEnd = timeToMinutes(window.endTime);

      for (let startMin = windowStart; startMin + durationMinutes <= windowEnd; startMin += durationMinutes) {
        const startTime = fromMinutes(startMin);
        const endTime = fromMinutes(startMin + durationMinutes);
        const startUtc = clinicLocalToUtc(date, startTime);
        if (startUtc.getTime() <= nowMs) {
          continue;
        }

        const blocked = blocks.some(
          (b) =>
            b.date === date &&
            overlaps(startMin, startMin + durationMinutes, timeToMinutes(b.startTime), timeToMinutes(b.endTime))
        );
        const bookedOverlap = booked.some((appointment) => {
          const appointmentStart = new Date(appointment.startsAt).getTime();
          const appointmentEnd = appointmentStart + appointment.durationMinutes * 60_000;
          const slotEndUtc = startUtc.getTime() + durationMinutes * 60_000;
          return appointmentStart < slotEndUtc && startUtc.getTime() < appointmentEnd;
        });

        slots.push({
          date,
          startTime,
          endTime,
          available: !blocked && !bookedOverlap,
        });
      }
    }
  }

  return slots;
}

export function createSlotsService(queries: SlotQueries): SlotsService {
  const getSlotsForDoctor = async (
    doctorId: string,
    typeId: string,
    rangeStart?: string,
    options?: { rangeDays?: number; now?: Date }
  ): Promise<Slot[]> => {
    const { rangeDays = 30, now = new Date() } = options ?? {};
    const startDate = rangeStart ?? utcToClinicParts(now).date;

    const doctor = await queries.getDoctorById(doctorId);
    if (!doctor) {
      throw new NotFoundError("doctor");
    }
    const type = await queries.getAppointmentTypeById(typeId);
    if (!type) {
      throw new NotFoundError("appointment type");
    }
    const offersType = await queries.getDoctorOffersType(doctorId, typeId);
    if (!offersType) {
      throw new NotFoundError("appointment type for this doctor");
    }

    const lastDate = addDays(startDate, rangeDays - 1);
    const fromInstant = clinicLocalToUtc(addDays(startDate, -1), "00:00");
    const toInstant = clinicLocalToUtc(addDays(lastDate, 2), "00:00");

    const [availability, blocks, booked] = await Promise.all([
      queries.listAvailabilityForDoctor(doctorId),
      queries.listAvailabilityBlocksForDoctor(doctorId, startDate, lastDate),
      queries.listBookedAppointmentsForDoctor(doctorId, fromInstant, toInstant),
    ]);

    return computeSlots({
      availability,
      blocks,
      booked,
      durationMinutes: type.durationMinutes,
      rangeStart: startDate,
      rangeDays,
      now,
    });
  };

  return {
    getSlotsForDoctor,
    async getAvailableSlot(doctorId, typeId, date, startTime, now) {
      const slots = await getSlotsForDoctor(doctorId, typeId, date, { rangeDays: 1, now });
      const slot = slots.find((s) => s.date === date && s.startTime === startTime && s.available);
      if (!slot) return undefined;
      return { slot, durationMinutes: timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime) };
    },
  };
}

export const slotsService = createSlotsService({
  getDoctorById,
  getAppointmentTypeById,
  getDoctorOffersType,
  listAvailabilityForDoctor,
  listAvailabilityBlocksForDoctor,
  listBookedAppointmentsForDoctor,
});