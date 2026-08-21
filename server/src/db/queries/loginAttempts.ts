import type { QueryExecutor } from "../client";

export type LoginAttemptQueries = {
  recordLoginAttempt(email: string, ip: string): Promise<void>;
  countRecentLoginAttempts(email: string, ip: string, since: string): Promise<number>;
};

export function createLoginAttemptQueries(executor: QueryExecutor): LoginAttemptQueries {
  return {
    async recordLoginAttempt(email, ip) {
      await executor.query(`INSERT INTO login_attempts (email, ip) VALUES ($1, $2)`, [email, ip]);
    },

    async countRecentLoginAttempts(email, ip, since) {
      const row = await executor.queryOne<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM login_attempts
         WHERE email = $1 AND ip = $2 AND attempted_at >= $3`,
        [email, ip, since]
      );
      return row?.count ?? 0;
    },
  };
}
