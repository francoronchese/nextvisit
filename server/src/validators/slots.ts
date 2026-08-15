import { z } from "zod";
import { dateSchema } from "@nextvisit/shared";

export const slotsQuerySchema = z.object({
  typeId: z.string().uuid(),
  // Optional so the server can default to "today" in the clinic timezone; the
  // patient's browser timezone must not decide where the 30-day range starts.
  date: dateSchema.optional(),
});