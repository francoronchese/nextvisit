import type { Request, Response } from "express";
import {
  appointmentTypeSchema,
  doctorSchema,
  healthInsuranceSchema,
  specialtySchema,
} from "@nextvisit/shared";
import { catalogService } from "../services/catalog";
import { parseIdParam } from "../utils/parseIdParam";
import { respondWithResource } from "../utils/respondWithResource";

export async function getSpecialties(_req: Request, res: Response): Promise<void> {
  await respondWithResource(res, () => catalogService.getSpecialties(), specialtySchema.array());
}

export async function getHealthInsurances(_req: Request, res: Response): Promise<void> {
  await respondWithResource(
    res,
    () => catalogService.getHealthInsurances(),
    healthInsuranceSchema.array()
  );
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