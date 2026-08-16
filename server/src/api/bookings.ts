import { Router } from "express";
import { createBooking } from "../controllers/bookings";
import { asyncHandler } from "../utils/asyncHandler";

export const bookingsRouter = Router();

bookingsRouter.post("/bookings", asyncHandler(createBooking));