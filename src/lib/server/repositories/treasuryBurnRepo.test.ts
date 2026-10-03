import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Db } from "../db/types";
import { createTestDb, resetTestDb } from "../db/testDb";
import { listTreasuryBurns, recordTreasuryBurn, sumBurnedBaseUnits, TreasuryBurnError } from "./treasuryBurnRepo";

describe("treasuryBurnRepo", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  it("records a real, observed burn", async () => {
    const { burn, created } = await recordTreasuryBurn(db, {
      amountBaseUnits: 1_000_000_000n,
      reason: "Community vote: burn unused Q1 giveaway allocation",
      transactionSignature: "burnSig1".padEnd(64, "1"),
    });
    expect(created).toBe(true);
    expect(burn.amountBaseUnits).toBe(1_000_000_000n);
    expect(burn.reason).toContain("Community vote");
  });

  it("is idempotent on transactionSignature -- recording the same burn twice is a no-op, never double-counted", async () => {
    const input = {
      amountBaseUnits: 5_000_000_000n,
      reason: "Permanent burn of excess buyback-acquired SALV",
      transactionSignature: "burnSigDup".padEnd(64, "2"),
    };
    const first = await recordTreasuryBurn(db, input);
    const second = await recordTreasuryBurn(db, input);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.burn.id).toBe(first.burn.id);

    expect(await sumBurnedBaseUnits(db)).toBe(5_000_000_000n); // not 10,000,000,000 -- recorded exactly once
  });

  it("rejects a non-positive amount", async () => {
    await expect(
      recordTreasuryBurn(db, { amountBaseUnits: 0n, reason: "x", transactionSignature: "burnSigZero".padEnd(64, "3") })
    ).rejects.toBeInstanceOf(TreasuryBurnError);
    await expect(
      recordTreasuryBurn(db, { amountBaseUnits: -1n, reason: "x", transactionSignature: "burnSigNeg".padEnd(64, "4") })
    ).rejects.toBeInstanceOf(TreasuryBurnError);
  });

  it("rejects an empty reason -- a burn must always be documented", async () => {
    await expect(
      recordTreasuryBurn(db, { amountBaseUnits: 1n, reason: "   ", transactionSignature: "burnSigNoReason".padEnd(64, "5") })
    ).rejects.toBeInstanceOf(TreasuryBurnError);
  });

  it("sumBurnedBaseUnits sums every recorded burn", async () => {
    await recordTreasuryBurn(db, { amountBaseUnits: 1_000n, reason: "a", transactionSignature: "burnSigA".padEnd(64, "6") });
    await recordTreasuryBurn(db, { amountBaseUnits: 2_000n, reason: "b", transactionSignature: "burnSigB".padEnd(64, "7") });
    expect(await sumBurnedBaseUnits(db)).toBe(3_000n);
  });

  it("listTreasuryBurns returns every burn, most recent first", async () => {
    await recordTreasuryBurn(db, { amountBaseUnits: 1n, reason: "first", transactionSignature: "burnSigList1".padEnd(64, "8") });
    await recordTreasuryBurn(db, { amountBaseUnits: 2n, reason: "second", transactionSignature: "burnSigList2".padEnd(64, "9") });
    const burns = await listTreasuryBurns(db);
    expect(burns.length).toBe(2);
    expect(burns[0].reason).toBe("second");
  });

  it("the append-only trigger rejects any attempt to mutate a recorded burn", async () => {
    const { burn } = await recordTreasuryBurn(db, {
      amountBaseUnits: 1_000n,
      reason: "immutability test",
      transactionSignature: "burnSigImmutable".padEnd(64, "0"),
    });
    await expect(db.query("UPDATE treasury_burns SET reason = 'tampered' WHERE id = $1", [burn.id])).rejects.toThrow();
    await expect(db.query("DELETE FROM treasury_burns WHERE id = $1", [burn.id])).rejects.toThrow();
  });
});
