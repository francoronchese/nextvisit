import type { Request, Response } from "express";
import { authService } from "../services/auth";
import { parseRequest, respondWithResource } from "../utils/respond";
import { loginResponseSchema, loginSchema } from "../validators/auth";

export async function login(req: Request, res: Response): Promise<void> {
  const body = parseRequest(loginSchema, req.body, res, "invalid body");
  if (!body) return;
  await respondWithResource(
    res,
    () => authService.login(body.email, body.password),
    { schema: loginResponseSchema }
  );
}