import { z } from "zod";
import { userRoleEnum } from "./enums";

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: userRoleEnum,
  doctorId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof userSchema>;