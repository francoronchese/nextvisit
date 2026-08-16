import type { Request, Response } from "express";
import { slotSchema } from "@nextvisit/shared";
import { slotsService } from "../services/slots";
import { slotsQuerySchema } from "../validators/slots";
import { parseIdParam } from "../utils/parseIdParam";
import { parseRequest, respondWithResource } from "../utils/respond";

export async function getSlotsForDoctor(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  const query = parseRequest(slotsQuerySchema, req.query, res, "invalid query");
  if (!query) return;

  await respondWithResource(
    res,
    () => slotsService.getSlotsForDoctor(id, query.typeId, query.date),
    { schema: slotSchema.array() }
  );
}