import type { Request, Response } from "express";
import { availabilityBlockSchema, availabilitySchema, doctorSchema } from "@nextvisit/shared";
import { availabilityService } from "../services/availability";
import { parseIdParam } from "../utils/parseIdParam";
import { parseRequest, respondDeleted, respondWithResource } from "../utils/respond";
import {
  availabilityBlockInputSchema,
  availabilityInputSchema,
  doctorListQuerySchema,
} from "../validators/availability";

export async function getDoctors(_req: Request, res: Response): Promise<void> {
  await respondWithResource(res, () => availabilityService.listDoctors(), {
    schema: doctorSchema.array(),
  });
}

export async function getAvailability(req: Request, res: Response): Promise<void> {
  const query = parseRequest(doctorListQuerySchema, req.query, res, "invalid query");
  if (!query) return;
  await respondWithResource(res, () => availabilityService.listAvailabilityForDoctor(query.doctorId), {
    schema: availabilitySchema.array(),
  });
}

export async function createAvailability(req: Request, res: Response): Promise<void> {
  const body = parseRequest(availabilityInputSchema, req.body, res, "invalid body");
  if (!body) return;
  await respondWithResource(
    res,
    () => availabilityService.createAvailability(body),
    { schema: availabilitySchema, status: 201 }
  );
}

export async function updateAvailability(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  const body = parseRequest(availabilityInputSchema, req.body, res, "invalid body");
  if (!body) return;
  await respondWithResource(res, () => availabilityService.updateAvailability(id, body), {
    schema: availabilitySchema,
  });
}

export async function deleteAvailability(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  await respondDeleted(res, () => availabilityService.deleteAvailability(id));
}

export async function getAvailabilityBlocks(req: Request, res: Response): Promise<void> {
  const query = parseRequest(doctorListQuerySchema, req.query, res, "invalid query");
  if (!query) return;
  await respondWithResource(res, () => availabilityService.listBlocksForDoctor(query.doctorId), {
    schema: availabilityBlockSchema.array(),
  });
}

export async function createAvailabilityBlock(req: Request, res: Response): Promise<void> {
  const body = parseRequest(availabilityBlockInputSchema, req.body, res, "invalid body");
  if (!body) return;
  await respondWithResource(
    res,
    () => availabilityService.createBlock(body),
    { schema: availabilityBlockSchema, status: 201 }
  );
}

export async function deleteAvailabilityBlock(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  await respondDeleted(res, () => availabilityService.deleteBlock(id));
}