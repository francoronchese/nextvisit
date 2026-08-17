import type { Response } from "express";
import { z } from "zod";
import { httpErrorStatus } from "./httpError";

// Shared controller helpers: every controller reads the same HTTP shape, so the
// client can rely on a single error envelope.

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

async function renderHttpError(res: Response, error: unknown): Promise<boolean> {
  const httpStatus = httpErrorStatus(error);
  if (httpStatus === undefined) {
    return false;
  }
  res.status(httpStatus).json({ error: error instanceof Error ? error.message : "unexpected error" });
  return true;
}

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
    if (await renderHttpError(res, error)) return;
    throw error;
  }
}

export async function respondDeleted(res: Response, resource: () => Promise<void>): Promise<void> {
  try {
    await resource();
    res.status(204).end();
  } catch (error) {
    if (await renderHttpError(res, error)) return;
    throw error;
  }
}