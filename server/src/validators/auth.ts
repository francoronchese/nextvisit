import { z } from "zod";
import { userSchema } from "@nextvisit/shared";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const loginResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
});