import { z } from "zod";
import { userSchema } from "./user";

// Response composite for the staff login (ARCHITECTURE.md §1.1: response
// composites live next to the domain schemas in shared, not in the server's
// request validators).
export const loginResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;
