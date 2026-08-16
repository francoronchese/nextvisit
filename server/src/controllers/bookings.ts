import type { Request, Response } from "express";
import { bookingResponseSchema } from "@nextvisit/shared";
import { bookingService } from "../services/bookings";
import { httpErrorStatus } from "../utils/httpError";
import { bookAppointmentSchema } from "../validators/booking";

export async function createBooking(req: Request, res: Response): Promise<void> {
  const body = bookAppointmentSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body" });
    return;
  }
  try {
    const result = await bookingService.book(body.data);
    res.status(201).json(bookingResponseSchema.parse(result));
  } catch (error) {
    const status = httpErrorStatus(error);
    if (status !== undefined) {
      res.status(status).json({ error: error instanceof Error ? error.message : "unexpected error" });
      return;
    }
    throw error;
  }
}