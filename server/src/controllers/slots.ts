import type { Request, Response } from "express";
import { slotSchema } from "@nextvisit/shared";
import { slotsService } from "../services/slots";
import { slotsQuerySchema } from "../validators/slots";
import { parseIdParam } from "../utils/parseIdParam";
import { respondWithResource } from "../utils/respondWithResource";

export async function getSlotsForDoctor(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  const query = slotsQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "invalid query" });
    return;
  }

  await respondWithResource(
    res,
    () => slotsService.getSlotsForDoctor(id, query.data.typeId, query.data.date),
    slotSchema.array()
  );
}