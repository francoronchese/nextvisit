import { z } from "zod";

export const oneTimeLinkSchema = z.object({
  id: z.string().uuid(),
  appointmentId: z.string().uuid(),
  token: z.string().min(32),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  usedAt: z.string().datetime().nullish(),
});

export type OneTimeLink = z.infer<typeof oneTimeLinkSchema>;