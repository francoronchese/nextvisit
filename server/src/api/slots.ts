import { Router } from "express";
import { getSlotsForDoctor } from "../controllers/slots";
import { asyncHandler } from "../utils/asyncHandler";

export const slotsRouter = Router();

slotsRouter.get("/doctors/:id/slots", asyncHandler(getSlotsForDoctor));