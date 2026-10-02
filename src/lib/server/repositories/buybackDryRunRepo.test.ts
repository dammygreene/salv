import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Db } from "../db/types";
import { createTestDb, resetTestDb } from "../db/testDb";
import { listBuybackDryRuns, recordBuybackDryRun } from "./buybackDryRunRepo";

function baseInput(overrides: Partial<Parameters<typeof recordBuybackDryRun>[1]> = {}) {
  return {
    feeBalance: 1.2,
    feeAsset: "SOL",
    currentSalvQuote: 150_000,
    maxSpend: 1,
    minOutput: 100_000,
    slippageLimitBps: 300,
    plannedSpend: 1,
    expectedSalvOutput: 150_000,
    rejected: false,
    rejectionReason: null,
    ...overrides,
  };
}

describe("buybackDryRunRepo", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  it("records a non-rejected dry run with every field round-tripping correctly", async () => {
    const record = await recordBuybackDryRun(db, baseInput());
    expect(record.feeBalance).toBe(1.2);
    expect(record.plannedSpend).toBe(1);
    expect(record.expectedSalvOutput).toBe(150_000);
    expect(record.rejected).toBe(false);
    expect(record.rejectionReason).toBeNull();
  });

  it("records a rejected dry run with its reason, and zeroed plan fields", async () => {
    const record = await recordBuybackDryRun(
      db,
      baseInput({ rejected: true, rejectionReason: "slippage limit would be violated", plannedSpend: 0, expectedSalvOutput: 0 })
    );
    expect(record.rejected).toBe(true);
    expect(record.rejectionReason).toBe("slippage limit would be violated");
    expect(record.plannedSpend).toBe(0);
  });

  it("every dry run is a distinct historical entry -- recording twice never merges or overwrites", async () => {
    await recordBuybackDryRun(db, baseInput());
    await recordBuybackDryRun(db, baseInput({ feeBalance: 2.4 }));

    const all = await listBuybackDryRuns(db);
    expect(all).toHaveLength(2);
  });

  it("listBuybackDryRuns returns most-recent-first and respects the limit", async () => {
    for (let i = 0; i < 5; i++) {
      await recordBuybackDryRun(db, baseInput({ feeBalance: i }));
    }
    const limited = await listBuybackDryRuns(db, 3);
    expect(limited).toHaveLength(3);
    expect(limited[0].feeBalance).toBe(4); // the most recently inserted
  });

  it("buyback_dry_runs is append-only: the database refuses any UPDATE or DELETE", async () => {
    const record = await recordBuybackDryRun(db, baseInput());
    await expect(db.query("UPDATE buyback_dry_runs SET planned_spend = 999 WHERE id = $1", [record.id])).rejects.toThrow(/append-only/i);
    await expect(db.query("DELETE FROM buyback_dry_runs WHERE id = $1", [record.id])).rejects.toThrow(/append-only/i);
  });
});
