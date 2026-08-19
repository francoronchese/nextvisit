import type { QueryExecutor } from "../client";

// No-show auto-mark (ticket 15, ADR-0004): a scheduled job ends appointments
// whose start time passed. listOverdue is the job's snapshot; markNoShow
// re-guards on status and start so a write is a no-op if the appointment was
// cancelled or ended in between.
export type NoShowCandidate = {
  appointmentId: string;
};

export type NoShowQueries = {
  listOverdue(now: Date): Promise<NoShowCandidate[]>;
  markNoShow(appointmentId: string, now: Date): Promise<boolean>;
};

export function createNoShowQueries(executor: QueryExecutor): NoShowQueries {
  return {
    async listOverdue(now) {
      const rows = await executor.query<{ id: string }>(
        `SELECT id
         FROM appointments
         WHERE status = 'scheduled' AND starts_at < $1
         ORDER BY starts_at`,
        [now.toISOString()]
      );
      return rows.map((row) => ({ appointmentId: row.id }));
    },

    async markNoShow(appointmentId, now) {
      const row = await executor.queryOne<{ id: string }>(
        `UPDATE appointments
         SET status = 'ended', attendance = 'no_show'
         WHERE id = $1 AND status = 'scheduled' AND starts_at < $2
         RETURNING id`,
        [appointmentId, now.toISOString()]
      );
      return row !== undefined;
    },
  };
}