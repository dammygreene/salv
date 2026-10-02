import "server-only";
import path from "path";
import type { Pool as PgPool } from "pg";
import type { PGlite } from "@electric-sql/pglite";
import { Db } from "./types";
import { runMigrations } from "./migrate";

/**
 * Picks the real backend at runtime:
 *  - DATABASE_URL set  -> a real Postgres instance via `pg` (Supabase,
 *    Neon, RDS, whatever — anything that speaks Postgres wire protocol).
 *  - DATABASE_URL unset -> an embedded PGlite instance (a real Postgres
 *    engine compiled to WASM, persisted under .data/pglite). This is a
 *    genuine Postgres — the same SQL, constraints, and triggers run
 *    either way — just with zero external infrastructure, which is what
 *    makes this usable in this sandbox and in any plain `npm run dev`.
 *
 * DATABASE_URL must never be NEXT_PUBLIC_*; this module is `server-only`.
 */

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
  };
}

async function createDb(): Promise<Db> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  let db: Db;
  if (databaseUrl) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: databaseUrl, max: 5 });
    db = wrapPgPool(pool);
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const dataDir = path.join(process.cwd(), ".data", "pglite");
    const pglite = await PGlite.create(dataDir);
    db = wrapPglite(pglite);
  }

  await runMigrations(db);
  return db;
}

/** Lazily creates and migrates the shared app database connection. Safe
 * to call from any server-only module; the connection + migrations only
 * run once per process. */
export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = createDb();
  }
  return dbPromise;
}
