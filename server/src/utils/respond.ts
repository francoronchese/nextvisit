import type { Response } from "express";
import { z } from "zod";
import { httpErrorStatus } from "./httpError";

// Shared controller helpers: every controller reads the same shape —
// parse the request, call the service, render the result or the HttpError.

export function parseRequest<T>(
  schema: z.ZodType<T>,
  input: unknown,
  res: Response,
  errorMessage: string
): T | undefined {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    res.status(400).json({ error: errorMessage });
    return undefined;
  }
  return parsed.data;
}

export type RespondOptions<T> = {
  schema?: z.ZodType<T>;
  status?: number;
};

export async function respondWithResource<T>(
  res: Response,
  resource: () => Promise<T>,
  options: RespondOptions<T> = {}
): Promise<void> {
  const { schema, status = 200 } = options;
  try {
    const data = await resource();
    res.status(status).json(schema ? schema.parse(data) : data);
  } catch (error) {
    const httpStatus = httpErrorStatus(error);
    if (httpStatus !== undefined) {
      res.status(httpStatus).json({ error: error instanceof Error ? error.message : "unexpected error" });
      return;
    }
    throw error;
  }
}