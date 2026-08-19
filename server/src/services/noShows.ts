import { query, queryOne } from "../db/client";
import { createNoShowQueries, type NoShowQueries } from "../db/queries/noShows";

export type NoShowServiceDeps = {
  queries: NoShowQueries;
};

export type NoShowService = {
  markOverdue(options?: { now?: Date }): Promise<{ noShowsMarked: number }>;
};

export function createNoShowService(deps: NoShowServiceDeps): NoShowService {
  const { queries } = deps;
  return {
    async markOverdue(options) {
      const now = options?.now ?? new Date();
      const overdue = await queries.listOverdue(now);

      let noShowsMarked = 0;
      for (const candidate of overdue) {
        // The UPDATE guards on status and start time, so an appointment
        // cancelled or ended between the list and the write is skipped instead
        // of being counted.
        if (await queries.markNoShow(candidate.appointmentId, now)) {
          noShowsMarked += 1;
        }
      }
      return { noShowsMarked };
    },
  };
}

const poolNoShowQueries = createNoShowQueries({ query, queryOne });

export const noShowService: NoShowService = createNoShowService({ queries: poolNoShowQueries });