import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe("getDb production safety", () => {
  afterEach(() => {
    restoreEnv();
    vi.resetModules();
  });

  it("refuses to start in production with no DATABASE_URL and no explicit override", async () => {
    vi.resetModules();
    (process.env as Record<string, string>).NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    delete process.env.CULLER_ALLOW_PGLITE_IN_PRODUCTION;

    const { getDb, DatabaseConfigurationError } = await import("./client");
    await expect(getDb()).rejects.toBeInstanceOf(DatabaseConfigurationError);
    await expect(getDb()).rejects.toThrow(/DATABASE_URL/);
  });

  it("never silently falls back to PGlite in production -- the error message says so explicitly", async () => {
    vi.resetModules();
    (process.env as Record<string, string>).NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    delete process.env.CULLER_ALLOW_PGLITE_IN_PRODUCTION;

    const { getDb } = await import("./client");
    await expect(getDb()).rejects.toThrow(/never silently fall(s)? back/i);
  });

  it("does not throw the configuration error in production once DATABASE_URL is set (even if the real connection then fails for other reasons)", async () => {
    vi.resetModules();
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://invalid-host-for-test:5432/db";
    delete process.env.CULLER_ALLOW_PGLITE_IN_PRODUCTION;

    const { getDb, DatabaseConfigurationError } = await import("./client");
    // This will eventually reject because the host doesn't exist -- that's
    // a real connectivity failure, which is fine and expected here. The
    // point of this test is narrower: it must NOT be our configuration
    // error, i.e. the presence of DATABASE_URL must be what's checked.
    await expect(getDb()).rejects.not.toBeInstanceOf(DatabaseConfigurationError);
  }, 15_000);

  it("does not require DATABASE_URL outside production (falls back to the embedded PGlite engine)", async () => {
    vi.resetModules();
    (process.env as Record<string, string>).NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    delete process.env.CULLER_ALLOW_PGLITE_IN_PRODUCTION;

    const { getDb } = await import("./client");
    const db = await getDb();
    const result = await db.query<{ one: number }>("SELECT 1 AS one");
    expect(Number(result.rows[0].one)).toBe(1);
  }, 15_000);
});
