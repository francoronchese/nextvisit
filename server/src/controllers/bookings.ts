import type { Request, Response } from "express";
import { z } from "zod";
import { bookingResponseSchema } from "@nextvisit/shared";
import { bookingService, type BookAppointmentInput } from "../services/bookings";
import { parseRequest, respondWithResource } from "../utils/respond";
import { bookAppointmentSchema, secretaryBookAppointmentSchema } from "../validators/booking";

// The two booking endpoints differ only in the parsed schema; the service runs
// the same catalog, slot, cap, and email flow for the web and for the secretary
// booking on behalf.
function createBookingHandler<S extends z.ZodType<BookAppointmentInput, any, any>>(schema: S) {
  return async function handleBooking(req: Request, res: Response): Promise<void> {
    const body = parseRequest(schema, req.body, res, "invalid body");
    if (!body) return;
    await respondWithResource(res, () => bookingService.book(body), {
      schema: bookingResponseSchema,
      status: 201,
    });
  };
}

export const createBooking = createBookingHandler(bookAppointmentSchema);
export const createSecretaryBooking = createBookingHandler(secretaryBookAppointmentSchema);