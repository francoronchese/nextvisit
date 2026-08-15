import type { Request, Response } from "express";
import { z } from "zod";
import { appointmentTypeSchema, doctorSchema, specialtySchema } from "@nextvisit/shared";
import { catalogService, CatalogNotFoundError } from "../services/catalog";
import { idParamSchema } from "../validators/catalog";

function parseIdParam(req: Request, res: Response): string | undefined {
  const result = idParamSchema.safeParse(req.params);
  if (!result.success) {
    res.status(400).json({ error: "invalid id" });
    return undefined;
  }
  return result.data.id;
}

async function respondWithResource<T>(
  res: Response,
  resource: () => Promise<T>,
  responseSchema: z.ZodType<T>
): Promise<void> {
  try {
    res.json(responseSchema.parse(await resource()));
  } catch (error) {
    if (error instanceof CatalogNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
}

export async function getSpecialties(_req: Request, res: Response): Promise<void> {
  await respondWithResource(res, () => catalogService.getSpecialties(), specialtySchema.array());
}

export async function getAppointmentTypesForSpecialty(
  req: Request,
  res: Response
): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  await respondWithResource(
    res,
    () => catalogService.getAppointmentTypesForSpecialty(id),
    appointmentTypeSchema.array()
  );
}

export async function getDoctorsForType(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  await respondWithResource(
    res,
    () => catalogService.getDoctorsForType(id),
    doctorSchema.array()
  );
}