import type { Request, Response } from "express";
import { remindersService } from "../services/reminders";

export async function sendReminderEmails(_req: Request, res: Response): Promise<void> {
  const { remindersSent } = await remindersService.sendDue();
  res.json({ remindersSent });
}