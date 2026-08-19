import { z } from "zod";

// The copay table is a name → copay amount mapping (spec). Name is trimmed so
// the DB unique index on health_insurances.name never sees accidental spaces.
export const healthInsuranceInputSchema = z.object({
  name: z.string().trim().min(1),
  copayAmount: z.number().nonnegative(),
});
