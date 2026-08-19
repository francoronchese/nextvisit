import type { Request, Response } from "express";
import { userSchema } from "@nextvisit/shared";
import { usersService } from "../services/users";
import { parseRequest, respondWithResource } from "../utils/respond";
import { createUserSchema } from "../validators/users";

export async function createUser(req: Request, res: Response): Promise<void> {
  const body = parseRequest(createUserSchema, req.body, res, "invalid body");
  if (!body) return;
  await respondWithResource(
    res,
    () => usersService.createUser(body),
    { schema: userSchema, status: 201 }
  );
}

export async function listUsers(_req: Request, res: Response): Promise<void> {
  await respondWithResource(res, () => usersService.listUsers(), {
    schema: userSchema.array(),
  });
}
