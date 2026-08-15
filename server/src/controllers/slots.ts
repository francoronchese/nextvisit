import type { Request, Response } from "express";
import { slotSchema } from "@nextvisit/shared";
import { SlotsNotFoundError, slotsService } from "../services/slots";
import { slotsQuerySchema } from "../validators/slots";
import { idParamSchema } from "../validators/catalog";

export async function getSlotsForDoctor(req: Request, res: Response): Promise<void> {
  const id = idParamSchema.safeParse(req.params);
  if (!id.success) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const query = slotsQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "invalid query" });
    return;
  }

  try {
    const slots = await slotsService.getSlotsForDoctor(
      id.data.id,
      query.data.typeId,
      query.data.date
    );
    res.json(slotSchema.array().parse(slots));
  } catch (error) {
    if (error instanceof SlotsNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
}