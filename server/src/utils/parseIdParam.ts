import type { Request, Response } from "express";
import { idParamSchema } from "../validators/catalog";

export function parseIdParam(req: Request, res: Response): string | undefined {
  const result = idParamSchema.safeParse(req.params);
  if (!result.success) {
    res.status(400).json({ error: "invalid id" });
    return undefined;
  }
  return result.data.id;
}