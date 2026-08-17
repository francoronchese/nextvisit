import { Router } from "express";
import { sendReminderEmails } from "../controllers/reminders";
import { requireRemindersSecret } from "../middlewares/remindersAuth";
import { asyncHandler } from "../utils/asyncHandler";

export const remindersRouter = Router();

remindersRouter.post("/reminders", requireRemindersSecret, asyncHandler(sendReminderEmails));
