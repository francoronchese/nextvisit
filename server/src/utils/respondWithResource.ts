import type { Response } from "express";
import { z } from "zod";
import { NotFoundError } from "./notFoundError";

export async function respondWithResource<T>(
  res: Response,
  resource: () => Promise<T>,
  responseSchema: z.ZodType<T>
): Promise<void> {
  try {
    res.json(responseSchema.parse(await resource()));
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
}