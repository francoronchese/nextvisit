import { z } from "zod";
import { staffRoleEnum } from "@nextvisit/shared";

// The admin creates credentials only for secretary and doctor roles; admin is
// bootstrapped by the seed (CONTEXT.md: Admin creates the credentials for
// secretaries and doctors). A doctor user must name the doctor record its
// appointments belong to; a secretary user must not carry one.
export const createUserSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    role: staffRoleEnum,
    doctorId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === "doctor" && !value.doctorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["doctorId"],
        message: "a doctor user must be linked to a doctor record",
      });
    }
    if (value.role === "secretary" && value.doctorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["doctorId"],
        message: "a secretary user cannot be linked to a doctor record",
      });
    }
  });
