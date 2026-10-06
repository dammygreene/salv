import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Db } from "../db/types";
import { createTestDb, resetTestDb } from "../db/testDb";
import { FeeWalletError, getFeeWalletStatus, recordFeeEvent } from "./feeWalletRepo";

describe("feeWalletRepo", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  it("records an IN event and reflects it in the status (balance = totalReceived when nothing claimed)", async () => {
    await recordFeeEvent(db, { direction: "IN", amount: 1.2, source: "stonkfun-creator-fee", transactionSignature: "sigIn1" });
    const status = await getFeeWalletStatus(db, "SOL");
    expect(status.totalReceived).toBe(1.2);
    expect(status.claimed).toBe(0);
    expect(status.balance).toBe(1.2);
    expect(status.events).toHaveLength(1);
  });

  it("rejects a non-positive amount rather than silently recording a zero/negative fee event", async () => {
    await expect(recordFeeEvent(db, { direction: "IN", amount: 0, source: "x", transactionSignature: "sigZero" })).rejects.toThrow(FeeWalletError);
    await expect(recordFeeEvent(db, { direction: "IN", amount: -5, source: "x", transactionSignature: "sigNeg" })).rejects.toThrow(FeeWalletError);
  });

  it("is idempotent on transaction_signature: replaying the same signature does not double-count revenue", async () => {
    const first = await recordFeeEvent(db, { direction: "IN", amount: 2, source: "stonkfun", transactionSignature: "sigReplay" });
    const second = await recordFeeEvent(db, { direction: "IN", amount: 2, source: "stonkfun", transactionSignature: "sigReplay" });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.event.id).toBe(first.event.id);

    const status = await getFeeWalletStatus(db, "SOL");
    expect(status.totalReceived).toBe(2); // not 4
    expect(status.events).toHaveLength(1);
  });

  it("an OUT event reduces the balance; balance = totalReceived - claimed", async () => {
    await recordFeeEvent(db, { direction: "IN", amount: 5, source: "stonkfun", transactionSignature: "sigIn2" });
    await recordFeeEvent(db, { direction: "OUT", amount: 3, source: "buyback-execution", transactionSignature: "sigOut1" });

    const status = await getFeeWalletStatus(db, "SOL");
    expect(status.totalReceived).toBe(5);
    expect(status.claimed).toBe(3);
    expect(status.balance).toBe(2);
  });

  it("tracks separate assets independently", async () => {
    await recordFeeEvent(db, { direction: "IN", amount: 10, asset: "SOL", source: "a", transactionSignature: "sigSol" });
    await recordFeeEvent(db, { direction: "IN", amount: 500, asset: "USDC", decimals: 6, source: "b", transactionSignature: "sigUsdc" });

    const solStatus = await getFeeWalletStatus(db, "SOL");
    const usdcStatus = await getFeeWalletStatus(db, "USDC");
    expect(solStatus.totalReceived).toBe(10);
    expect(usdcStatus.totalReceived).toBe(500);
  });

  it("fee_wallet_events is append-only: the database refuses any UPDATE or DELETE, even bypassing the app layer", async () => {
    const { event } = await recordFeeEvent(db, { direction: "IN", amount: 1, source: "x", transactionSignature: "sigAppendOnly" });

    await expect(db.query("UPDATE fee_wallet_events SET amount = 999 WHERE id = $1", [event.id])).rejects.toThrow(/append-only/i);
    await expect(db.query("DELETE FROM fee_wallet_events WHERE id = $1", [event.id])).rejects.toThrow(/append-only/i);
  });
});
