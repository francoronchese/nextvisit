import { Router } from "express";
import { sendReminderEmails } from "../controllers/reminders";
import { requireSchedulerSecret } from "../middlewares/schedulerAuth";
import { asyncHandler } from "../utils/asyncHandler";

export const remindersRouter = Router();

remindersRouter.post("/reminders", requireSchedulerSecret, asyncHandler(sendReminderEmails));