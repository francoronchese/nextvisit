import type { Request, Response } from "express";
import { loginResponseSchema } from "@nextvisit/shared";
import { query, queryOne } from "../db/client";
import { createLoginAttemptQueries } from "../db/queries/loginAttempts";
import { authService, enforceLoginRateLimit } from "../services/auth";
import { parseRequest, respondWithResource } from "../utils/respond";
import { loginSchema } from "../validators/auth";

const loginAttemptQueries = createLoginAttemptQueries({ query, queryOne });

export async function login(req: Request, res: Response): Promise<void> {
  const body = parseRequest(loginSchema, req.body, res, "invalid body");
  if (!body) return;
  await respondWithResource(
    res,
    async () => {
      // Counted before judging (services/auth.ts): rejected logins accumulate.
      await enforceLoginRateLimit(loginAttemptQueries, body.email, req.ip ?? "unknown", new Date());
      return authService.login(body.email, body.password);
    },
    { schema: loginResponseSchema }
  );
}
