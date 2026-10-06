import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Db } from "../server/db/types";
import { createTestDb, resetTestDb } from "../server/db/testDb";
import { FeeWalletError, getFeeWalletStatus, recordFeeReceipt, recordFeeWithdrawal } from "./feeWallet";

describe("CULLER Fee Wallet", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  it("starts at a zero balance", async () => {
    const status = await getFeeWalletStatus(db);
    expect(status.balance).toBe(0);
    expect(status.totalReceived).toBe(0);
    expect(status.claimed).toBe(0);
  });

  it("tracks balance/source/transaction correctly as receipts come in", async () => {
    await recordFeeReceipt(db, { amount: 1.2, source: "stonkfun_creator_fee", transactionSignature: "sig1".padEnd(64, "1") });
    await recordFeeReceipt(db, { amount: 0.3, source: "stonkfun_creator_fee", transactionSignature: "sig2".padEnd(64, "1") });

    const status = await getFeeWalletStatus(db);
    expect(status.totalReceived).toBeCloseTo(1.5);
    expect(status.balance).toBeCloseTo(1.5);
    expect(status.events).toHaveLength(2);
    expect(status.events.every((e) => e.source === "stonkfun_creator_fee")).toBe(true);
  });

  it("recording the same transaction signature twice does not double-count revenue", async () => {
    await recordFeeReceipt(db, { amount: 1.0, source: "stonkfun_creator_fee", transactionSignature: "dup".padEnd(64, "1") });
    await recordFeeReceipt(db, { amount: 1.0, source: "stonkfun_creator_fee", transactionSignature: "dup".padEnd(64, "1") });
    const status = await getFeeWalletStatus(db);
    expect(status.totalReceived).toBe(1.0);
  });

  it("withdrawals (claimed amount) reduce the derived balance but not totalReceived", async () => {
    await recordFeeReceipt(db, { amount: 2.0, source: "stonkfun_creator_fee", transactionSignature: "in1".padEnd(64, "1") });
    await recordFeeWithdrawal(db, { amount: 0.5, source: "buyback", transactionSignature: "out1".padEnd(64, "1") });

    const status = await getFeeWalletStatus(db);
    expect(status.totalReceived).toBe(2.0);
    expect(status.claimed).toBe(0.5);
    expect(status.balance).toBe(1.5);
  });

  it("refuses to withdraw more than the current balance", async () => {
    await recordFeeReceipt(db, { amount: 1.0, source: "stonkfun_creator_fee", transactionSignature: "in2".padEnd(64, "1") });
    await expect(recordFeeWithdrawal(db, { amount: 5.0, source: "buyback", transactionSignature: "out2".padEnd(64, "1") })).rejects.toBeInstanceOf(
      FeeWalletError
    );
    const status = await getFeeWalletStatus(db);
    expect(status.balance).toBe(1.0); // unchanged
  });

  it("the fee wallet ledger is append-only", async () => {
    const { event } = await recordFeeReceipt(db, { amount: 1.0, source: "stonkfun_creator_fee", transactionSignature: "appendonly".padEnd(64, "1") });
    await expect(db.query("UPDATE fee_wallet_events SET amount = 999 WHERE id = $1", [event.id])).rejects.toThrow(/append-only/i);
  });

  it("is kept completely separate from the community reward vault (different tables, no shared totals)", async () => {
    await recordFeeReceipt(db, { amount: 10, source: "stonkfun_creator_fee", transactionSignature: "separate1".padEnd(64, "1") });
    const { getCommunityVaultStatus } = await import("./vault");
    const vaultStatus = await getCommunityVaultStatus(db);
    // Fee wallet activity must never move the vault's distributed/remaining figures.
    expect(vaultStatus.distributedCuller).toBe(0);
  });
});
