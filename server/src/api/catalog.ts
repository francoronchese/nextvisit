import { Router } from "express";
import {
  getAppointmentTypesForSpecialty,
  getDoctorsForType,
  getHealthInsurances,
  getSpecialties,
} from "../controllers/catalog";
import { asyncHandler } from "../utils/asyncHandler";

export const catalogRouter = Router();

catalogRouter.get("/specialties", asyncHandler(getSpecialties));
catalogRouter.get("/specialties/:id/types", asyncHandler(getAppointmentTypesForSpecialty));
catalogRouter.get("/types/:id/doctors", asyncHandler(getDoctorsForType));
catalogRouter.get("/health-insurances", asyncHandler(getHealthInsurances));