import type { NextFunction, Request, Response } from "express";
import { authService } from "../services/auth";

export async function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (!token) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const user = await authService.authenticate(token);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  req.user = user;
  next();
}