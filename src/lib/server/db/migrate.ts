import "server-only";
import { Db } from "./types";
import { MIGRATION_0001_INIT } from "./migrations/0001_init";
import { MIGRATION_0002_REWARD_SNAPSHOTS } from "./migrations/0002_reward_snapshots";
import { MIGRATION_0005_REWARD_LEDGER } from "./migrations/0005_reward_ledger";
import { MIGRATION_0006_COMBINED_REWARD_SUBMISSION } from "./migrations/0006_combined_reward_submission";
import { MIGRATION_0008_REMOVE_X_IDENTITY_LEADERBOARD } from "./migrations/0008_remove_x_identity_leaderboard";
import { MIGRATION_0009_REMOVE_LEGACY_TOKEN_INFRASTRUCTURE } from "./migrations/0009_remove_legacy_token_infrastructure";

interface Migration {
  name: string;
  sql: string;
}

// Add new migrations here, in order. Never edit a migration that has
// already shipped — add a new one instead.
const MIGRATIONS: Migration[] = [
  { name: "0001_init", sql: MIGRATION_0001_INIT },
  { name: "0002_reward_snapshots", sql: MIGRATION_0002_REWARD_SNAPSHOTS },
  { name: "0005_reward_ledger", sql: MIGRATION_0005_REWARD_LEDGER },
  { name: "0006_combined_reward_submission", sql: MIGRATION_0006_COMBINED_REWARD_SUBMISSION },
  { name: "0008_remove_x_identity_leaderboard", sql: MIGRATION_0008_REMOVE_X_IDENTITY_LEADERBOARD },
  { name: "0009_remove_legacy_token_infrastructure", sql: MIGRATION_0009_REMOVE_LEGACY_TOKEN_INFRASTRUCTURE },
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
