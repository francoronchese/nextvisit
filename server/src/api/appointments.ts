import { Router } from "express";
import {
  cancelAppointment,
  getAppointmentByToken,
  rescheduleAppointment,
} from "../controllers/appointments";
import { asyncHandler } from "../utils/asyncHandler";

export const appointmentsRouter = Router();

appointmentsRouter.get("/appointments/:token", asyncHandler(getAppointmentByToken));
appointmentsRouter.post("/appointments/:token/cancel", asyncHandler(cancelAppointment));
appointmentsRouter.post("/appointments/:token/reschedule", asyncHandler(rescheduleAppointment));