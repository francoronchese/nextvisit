import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@nextvisit/shared";
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

// RBAC gate for staff-only capabilities (spec: doctor panel is read-only, so a
// doctor session must not create appointments). Runs after requireAdminAuth.
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}