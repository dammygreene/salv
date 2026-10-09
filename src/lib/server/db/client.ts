import "server-only";
import fs from "fs";
import path from "path";
import type { Pool as PgPool } from "pg";
import type { PGlite } from "@electric-sql/pglite";
import { Db } from "./types";
import { runMigrations } from "./migrate";

/**
 * Picks the real backend at runtime:
 *  - DATABASE_URL set  -> a real Postgres instance via `pg` (Supabase,
 *    Neon, RDS, whatever — anything that speaks Postgres wire protocol).
 *  - DATABASE_URL unset, NOT production -> an embedded PGlite instance (a
 *    real Postgres engine compiled to WASM, persisted under
 *    .data/pglite). This is a genuine Postgres — the same SQL,
 *    constraints, and triggers run either way — just with zero external
 *    infrastructure, which is what makes local dev/tests usable with no
 *    setup.
 *  - DATABASE_URL unset, production -> throws immediately. Production
 *    must never silently run on a throwaway embedded database; better to
 *    fail loudly at startup than to serve real traffic against data that
 *    vanishes on redeploy.
 *
 * "Production" means `NODE_ENV === "production"`, which is what
 * `next build && next start` set automatically — not `next dev`. Set
 * `CULLER_ALLOW_PGLITE_IN_PRODUCTION=true` only for a throwaway staging
 * deploy that intentionally has no real database; this is not meant for
 * normal production use.
 *
 * DATABASE_URL must never be NEXT_PUBLIC_*; this module is `server-only`.
 */

export class DatabaseConfigurationError extends Error {}

let dbPromise: Promise<Db> | null = null;

function wrapPgPool(pool: PgPool): Db {
  return {
    async query(sql, params) {
      const result = await pool.query(sql, params as never[]);
      return { rows: result.rows };
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const txDb: Db = {
          query: async (sql, params) => {
            const result = await client.query(sql, params as never[]);
            return { rows: result.rows };
          },
          transaction: () => {
            throw new Error("Nested transactions are not supported.");
          },
        };
        const result = await fn(txDb);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

export function wrapPglite(pglite: PGlite): Db {
  return {
    async query(sql, params) {
      // PGlite's `.query()` uses the extended (prepared-statement)
      // protocol, which rejects multi-statement SQL (e.g. a migration
      // file with several `CREATE TABLE ...;` statements back to back).
      // `.exec()` uses the simple protocol and supports that, but does
      // not accept bound parameters. Migrations/raw multi-statement SQL
      // never pass params, so route on that instead of adding a second
      // method to the `Db` interface.
      if (!params || params.length === 0) {
        const results = await pglite.exec(sql);
        const last = results[results.length - 1];
        return { rows: (last?.rows ?? []) as never[] };
      }
      const result = await pglite.query(sql, params as never[]);
      return { rows: result.rows as never[] };
    },
    async transaction(fn) {
      return pglite.transaction(async (tx) => {
        const txDb: Db = {
          query: async (sql, params) => {
            if (!params || params.length === 0) {
              const results = await tx.exec(sql);
              const last = results[results.length - 1];
              return { rows: (last?.rows ?? []) as never[] };
            }
            const result = await tx.query(sql, params as never[]);
            return { rows: result.rows as never[] };
          },
          transaction: () => {
            throw new Error("Nested transactions are not supported.");
          },
        };
        return fn(txDb);
      });
    },
    close: () => pglite.close(),
  };
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

async function createDb(): Promise<Db> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  let closeOnFailure: (() => Promise<void>) | null = null;

  let db: Db;
  if (databaseUrl) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 5_000 });
    db = wrapPgPool(pool);
    closeOnFailure = () => pool.end();
  } else if (isProduction() && process.env.CULLER_ALLOW_PGLITE_IN_PRODUCTION?.trim() !== "true") {
    throw new DatabaseConfigurationError(
      "DATABASE_URL is not set. Production (NODE_ENV=production) must use a real Postgres database — " +
        "CULLER never silently falls back to the embedded PGlite engine in production, since that data " +
        "does not survive a redeploy. Set DATABASE_URL to a real Postgres connection string, or, only for " +
        "an intentionally throwaway staging deployment, set CULLER_ALLOW_PGLITE_IN_PRODUCTION=true."
    );
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    // Tests must use an isolated in-memory database. Reusing the development
    // data directory can leave a stale postmaster lock and abort the WASM
    // engine before the configuration test can run.
    const dataDir = process.env.NODE_ENV === "test" ? undefined : path.join(process.cwd(), ".data", "pglite");
    if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
    const pglite = dataDir ? await PGlite.create(dataDir) : new PGlite();
    db = wrapPglite(pglite);
  }

  try {
    await runMigrations(db);
    return db;
  } catch (error) {
    await closeOnFailure?.();
    throw error;
  }
}

/** Lazily creates and migrates the shared app database connection. Safe
 * to call from any server-only module; the connection + migrations only
 * run once per process. */
export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = createDb().catch((err) => {
      // Don't cache a failed connection attempt forever — if the
      // misconfiguration gets fixed without a full process restart
      // (e.g. some PaaS env-var reload paths), the next call should try
      // again instead of being stuck replaying the same rejection.
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}
