import { Router } from "express";
import { login } from "../controllers/auth";
import {
  createAvailability,
  createAvailabilityBlock,
  deleteAvailability,
  deleteAvailabilityBlock,
  getAvailability,
  getAvailabilityBlocks,
  getDoctors,
  updateAvailability,
} from "../controllers/availability";
import { createSecretaryBooking } from "../controllers/bookings";
import { requireAdminAuth, requireRole } from "../middlewares/adminAuth";
import { asyncHandler } from "../utils/asyncHandler";

export const adminRouter = Router();

// Login is public; every other /admin route requires a staff session token.
adminRouter.post("/admin/login", asyncHandler(login));

adminRouter.use(requireAdminAuth);

adminRouter.get("/admin/doctors", asyncHandler(getDoctors));
adminRouter.get("/admin/availability", asyncHandler(getAvailability));
adminRouter.post("/admin/availability", asyncHandler(createAvailability));
adminRouter.put("/admin/availability/:id", asyncHandler(updateAvailability));
adminRouter.delete("/admin/availability/:id", asyncHandler(deleteAvailability));
adminRouter.get("/admin/availability-blocks", asyncHandler(getAvailabilityBlocks));
adminRouter.post("/admin/availability-blocks", asyncHandler(createAvailabilityBlock));
adminRouter.delete("/admin/availability-blocks/:id", asyncHandler(deleteAvailabilityBlock));
adminRouter.post("/admin/appointments", requireRole("secretary"), asyncHandler(createSecretaryBooking));