import type { Request, Response } from "express";
import {
  appointmentTypeSchema,
  doctorSchema,
  healthInsuranceSchema,
  specialtySchema,
} from "@nextvisit/shared";
import { catalogService } from "../services/catalog";
import { parseIdParam } from "../utils/parseIdParam";
import { respondWithResource } from "../utils/respond";

export async function getSpecialties(_req: Request, res: Response): Promise<void> {
  await respondWithResource(res, () => catalogService.getSpecialties(), {
    schema: specialtySchema.array(),
  });
}

export async function getHealthInsurances(_req: Request, res: Response): Promise<void> {
  await respondWithResource(res, () => catalogService.getHealthInsurances(), {
    schema: healthInsuranceSchema.array(),
  });
}

export async function getAppointmentTypesForSpecialty(
  req: Request,
  res: Response
): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  await respondWithResource(res, () => catalogService.getAppointmentTypesForSpecialty(id), {
    schema: appointmentTypeSchema.array(),
  });
}

export async function getDoctorsForType(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  await respondWithResource(res, () => catalogService.getDoctorsForType(id), {
    schema: doctorSchema.array(),
  });
}