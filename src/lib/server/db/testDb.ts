import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { Db } from "./types";
import { wrapPglite } from "./client";
import { runMigrations } from "./migrate";

/**
 * A fully real, in-memory Postgres (PGlite, not a mock) for tests: same
 * SQL, same constraints, same triggers as production, just disposable.
 * This is the "lightweight test implementation" behind the same `Db`
 * interface every repository is written against — nothing here is
 * app-specific mock logic that could drift from real Postgres semantics.
 */
export async function createTestDb(): Promise<Db> {
  const pglite = new PGlite(); // no data dir => pure in-memory
  const db = wrapPglite(pglite);
  await runMigrations(db);
  return db;
}

/** Wipes all app data between tests while keeping the schema, so a
 * single booted instance can be reused across many test cases without
 * paying PGlite's one-time WASM startup cost each time. */
export async function resetTestDb(db: Db): Promise<void> {
  await db.query(`
    TRUNCATE TABLE
      reward_snapshots,
      points_ledger,
      salvage_actions,
      salvage_events,
      asset_classifications,
      assets,
      epochs,
      wallets,
      users
    RESTART IDENTITY CASCADE;
  `);
}
