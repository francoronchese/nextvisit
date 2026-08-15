import { z } from "zod";

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM");

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

export const dniSchema = z.string().regex(/^\d{7,8}$/, "DNI must be 7-8 digits");