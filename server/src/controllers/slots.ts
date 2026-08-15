import type { Request, Response } from "express";
import { slotSchema } from "@nextvisit/shared";
import { slotsService } from "../services/slots";
import { slotsQuerySchema } from "../validators/slots";
import { NotFoundError } from "../utils/notFoundError";
import { parseIdParam } from "../utils/parseIdParam";

export async function getSlotsForDoctor(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  const query = slotsQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "invalid query" });
    return;
  }

  try {
    const slots = await slotsService.getSlotsForDoctor(
      id,
      query.data.typeId,
      query.data.date
    );
    res.json(slotSchema.array().parse(slots));
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
}