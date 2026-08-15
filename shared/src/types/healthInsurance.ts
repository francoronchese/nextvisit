import { z } from "zod";

export const healthInsuranceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  copayAmount: z.number().nonnegative(),
});

export type HealthInsurance = z.infer<typeof healthInsuranceSchema>;