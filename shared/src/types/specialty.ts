import { z } from "zod";

export const specialtySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

export type Specialty = z.infer<typeof specialtySchema>;