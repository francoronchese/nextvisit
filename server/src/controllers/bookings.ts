import type { Request, Response } from "express";
import { z } from "zod";
import { bookingResponseSchema } from "@nextvisit/shared";
import { bookingService, type BookAppointmentInput } from "../services/bookings";
import { parseRequest, respondWithResource } from "../utils/respond";
import { bookAppointmentSchema, secretaryBookAppointmentSchema } from "../validators/booking";

// The wire keeps the slot as {date, startTime}; the service wants it as a
// ClinicLocalTime. This handler adapts the parsed body so the service layer
// never sees the wire's renames.
type BookingWireInput = Omit<BookAppointmentInput, "slot"> & { date: string; startTime: string };

// The two booking endpoints differ only in the parsed schema; the service runs
// the same catalog, slot, cap, and email flow for the web and for the secretary
// booking on behalf.
function createBookingHandler<S extends z.ZodType<BookingWireInput, any, any>>(schema: S) {
  return async function handleBooking(req: Request, res: Response): Promise<void> {
    const body = parseRequest(schema, req.body, res, "invalid body");
    if (!body) return;
    const { date, startTime, ...rest } = body;
    const input: BookAppointmentInput = {
      ...rest,
      slot: { date, time: startTime },
    };
    await respondWithResource(res, () => bookingService.book(input), {
      schema: bookingResponseSchema,
      status: 201,
    });
  };
}

export const createBooking = createBookingHandler(bookAppointmentSchema);
export const createSecretaryBooking = createBookingHandler(secretaryBookAppointmentSchema);