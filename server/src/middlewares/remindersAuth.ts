import type { NextFunction, Request, Response } from "express";
import { getRemindersSecret } from "../../config/env";

// The GitHub Actions scheduled workflow authenticates by sending the
// REMINDERS_SECRET as a bearer token. The route fails closed: an unset secret
// or a wrong one gets a 401.
export function requireRemindersSecret(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const expected = getRemindersSecret();
  const header = req.headers.authorization;
  const provided = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!expected || provided !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}
