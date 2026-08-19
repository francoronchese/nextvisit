import { Router } from "express";
import { markOverdueNoShows } from "../controllers/noShows";
import { requireSchedulerSecret } from "../middlewares/schedulerAuth";
import { asyncHandler } from "../utils/asyncHandler";

export const noShowsRouter = Router();

noShowsRouter.post("/no-shows", requireSchedulerSecret, asyncHandler(markOverdueNoShows));