import type { Request, Response } from "express";
import { bookingResponseSchema } from "@nextvisit/shared";
import { bookingService } from "../services/bookings";
import { parseRequest, respondWithResource } from "../utils/respond";
import { bookAppointmentSchema, secretaryBookAppointmentSchema } from "../validators/booking";

export async function createBooking(req: Request, res: Response): Promise<void> {
  const body = parseRequest(bookAppointmentSchema, req.body, res, "invalid body");
  if (!body) return;
  await respondWithResource(
    res,
    () => bookingService.book(body),
    { schema: bookingResponseSchema, status: 201 }
  );
}

export async function createAdminBooking(req: Request, res: Response): Promise<void> {
  const body = parseRequest(secretaryBookAppointmentSchema, req.body, res, "invalid body");
  if (!body) return;
  // Same catalog, slot, cap, and email flow as the public booking; the
  // secretary session (requireAdminAuth) is the only difference.
  await respondWithResource(
    res,
    () => bookingService.book(body),
    { schema: bookingResponseSchema, status: 201 }
  );
}