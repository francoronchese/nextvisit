import type { Request, Response } from "express";
import { bookingResponseSchema } from "@nextvisit/shared";
import { bookingService } from "../services/bookings";
import { parseRequest, respondWithResource } from "../utils/respond";
import { bookAppointmentSchema } from "../validators/booking";

export async function createBooking(req: Request, res: Response): Promise<void> {
  const body = parseRequest(bookAppointmentSchema, req.body, res, "invalid body");
  if (!body) return;
  await respondWithResource(
    res,
    () => bookingService.book(body),
    { schema: bookingResponseSchema, status: 201 }
  );
}