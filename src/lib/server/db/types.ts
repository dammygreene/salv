import "server-only";

/** Minimal, driver-agnostic query interface. Both the production
 * Postgres driver (`pg`) and the embedded dev/test engine (PGlite, a
 * real Postgres compiled to WASM) implement this same shape, so every
 * repository in this codebase is written once against `Db` and works
 * unchanged against either backend. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close?(): Promise<void>;
}
