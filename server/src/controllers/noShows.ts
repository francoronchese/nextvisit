import type { Request, Response } from "express";
import { noShowService } from "../services/noShows";

export async function markOverdueNoShows(_req: Request, res: Response): Promise<void> {
  const { noShowsMarked } = await noShowService.markOverdue();
  res.json({ noShowsMarked });
}