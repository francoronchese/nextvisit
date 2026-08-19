import type { Request, Response } from "express";
import { healthInsuranceSchema } from "@nextvisit/shared";
import { healthInsurancesService } from "../services/healthInsurances";
import { parseIdParam } from "../utils/parseIdParam";
import { parseRequest, respondDeleted, respondWithResource } from "../utils/respond";
import { healthInsuranceInputSchema } from "../validators/healthInsurances";

export async function listHealthInsurances(_req: Request, res: Response): Promise<void> {
  await respondWithResource(res, () => healthInsurancesService.listHealthInsurances(), {
    schema: healthInsuranceSchema.array(),
  });
}

export async function createHealthInsurance(req: Request, res: Response): Promise<void> {
  const body = parseRequest(healthInsuranceInputSchema, req.body, res, "invalid body");
  if (!body) return;
  await respondWithResource(
    res,
    () => healthInsurancesService.createHealthInsurance(body),
    { schema: healthInsuranceSchema, status: 201 }
  );
}

export async function updateHealthInsurance(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  const body = parseRequest(healthInsuranceInputSchema, req.body, res, "invalid body");
  if (!body) return;
  await respondWithResource(res, () => healthInsurancesService.updateHealthInsurance(id, body), {
    schema: healthInsuranceSchema,
  });
}

export async function deleteHealthInsurance(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  await respondDeleted(res, () => healthInsurancesService.deleteHealthInsurance(id));
}
