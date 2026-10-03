import "server-only";
import { Db } from "./types";
import { MIGRATION_0001_INIT } from "./migrations/0001_init";
import { MIGRATION_0002_REWARD_SNAPSHOTS } from "./migrations/0002_reward_snapshots";
import { MIGRATION_0003_SALV_TOKEN } from "./migrations/0003_salv_token";
import { MIGRATION_0004_SALV_TREASURY } from "./migrations/0004_salv_treasury";

interface Migration {
  name: string;
  sql: string;
}

// Add new migrations here, in order. Never edit a migration that has
// already shipped — add a new one instead.
const MIGRATIONS: Migration[] = [
  { name: "0001_init", sql: MIGRATION_0001_INIT },
  { name: "0002_reward_snapshots", sql: MIGRATION_0002_REWARD_SNAPSHOTS },
  { name: "0003_salv_token", sql: MIGRATION_0003_SALV_TOKEN },
  { name: "0004_salv_treasury", sql: MIGRATION_0004_SALV_TREASURY },
];

/** Applies any migration not yet recorded in schema_migrations, in
 * order, inside its own transaction. Safe to call on every process boot:
 * already-applied migrations are skipped. */
export async function runMigrations(db: Db): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const { rows } = await db.query<{ name: string }>("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    await db.transaction(async (tx) => {
      await tx.query(migration.sql);
      await tx.query("INSERT INTO schema_migrations (name) VALUES ($1)", [migration.name]);
    });
  }
}
