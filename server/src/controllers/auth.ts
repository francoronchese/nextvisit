import type { Request, Response } from "express";
import { authService } from "../services/auth";
import { InvalidCredentialsError } from "../utils/invalidCredentialsError";
import { loginResponseSchema, loginSchema } from "../validators/auth";

export async function login(req: Request, res: Response): Promise<void> {
  const body = loginSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid body" });
    return;
  }
  try {
    const result = await authService.login(body.data.email, body.data.password);
    res.json(loginResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({ error: error.message });
      return;
    }
    throw error;
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  res.json(req.user);
}