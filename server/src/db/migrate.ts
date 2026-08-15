import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { pool } from "./client";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

export async function runMigrations(p: Pool = pool): Promise<string[]> {
  await p.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows } = await p.query("SELECT filename FROM schema_migrations");
  const applied = new Set(rows.map((r) => (r as { filename: string }).filename));

  const appliedNow: string[] = [];

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const client = await p.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied migration: ${file}`);
      appliedNow.push(file);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return appliedNow;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  runMigrations()
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    })
    .finally(() => pool.end());
}