import { Router } from "express";
import { login } from "../controllers/auth";
import { requireAdminAuth } from "../middlewares/adminAuth";
import { asyncHandler } from "../utils/asyncHandler";

export const adminRouter = Router();

// Login is public; every other /admin route requires a staff session token.
adminRouter.post("/admin/login", asyncHandler(login));

adminRouter.use(requireAdminAuth);