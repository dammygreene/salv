import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Db } from "../server/db/types";
import { createTestDb, resetTestDb } from "../server/db/testDb";
import { BuybackPolicy, BuybackPolicyError, planAndRecordBuyback, planBuyback } from "./buyback";
import { listBuybackDryRuns } from "../server/repositories/buybackDryRunRepo";

const BASE_POLICY: BuybackPolicy = {
  maxSpend: 1.0,
  minOutputCuller: 100,
  slippageLimitBps: 500, // 5%
  expectedCullerMint: "CullerMint1111111111111111111111111111111111",
  expectedDestination: "TreasuryDest111111111111111111111111111111",
  expectedQuoteAsset: "SOL",
  expectedNetwork: "devnet",
};

const BASE_INPUT = {
  feeBalance: 1.2,
  feeAsset: "SOL",
  currentCullerQuotePerUnit: 150, // 150 CULLER per SOL
  observedCullerMint: BASE_POLICY.expectedCullerMint,
  observedDestination: BASE_POLICY.expectedDestination,
  observedNetwork: "devnet" as const,
};

describe("planBuyback (dry-run only, never executes)", () => {
  it("requires an explicit policy and throws if one is missing or malformed", () => {
    expect(() => planBuyback(undefined as unknown as BuybackPolicy, BASE_INPUT)).toThrow(BuybackPolicyError);
    expect(() => planBuyback({ ...BASE_POLICY, maxSpend: 0 }, BASE_INPUT)).toThrow(BuybackPolicyError);
    expect(() => planBuyback({ ...BASE_POLICY, slippageLimitBps: 20_000 }, BASE_INPUT)).toThrow(BuybackPolicyError);
  });

  it("plans a valid buyback matching the example in the Phase 5 spec (1.2 SOL fee -> 1.0 SOL buyback)", () => {
    const plan = planBuyback(BASE_POLICY, BASE_INPUT);
    expect(plan.rejected).toBe(false);
    expect(plan.plannedSpend).toBe(1.0); // capped by policy.maxSpend, not the full 1.2 SOL balance
    expect(plan.expectedCullerOutput).toBe(150);
    expect(plan.minOutputAfterSlippage).toBeCloseTo(142.5, 5); // 150 * 0.95
  });

  it("never plans to spend the entire treasury balance, even if maxSpend allows it", () => {
    const greedyPolicy: BuybackPolicy = { ...BASE_POLICY, maxSpend: 1000 }; // way more than the fee balance
    const plan = planBuyback(greedyPolicy, BASE_INPUT);
    expect(plan.rejected).toBe(false);
    expect(plan.plannedSpend).toBeLessThan(BASE_INPUT.feeBalance);
    expect(plan.plannedSpend).toBeCloseTo(BASE_INPUT.feeBalance * 0.9, 10); // hard 90% reserve ceiling
  });

  it("rejects (slippage rejection) when the worst-case output after slippage undercuts the minimum", () => {
    const strictPolicy: BuybackPolicy = { ...BASE_POLICY, minOutputCuller: 149, slippageLimitBps: 500 };
    const plan = planBuyback(strictPolicy, BASE_INPUT);
    expect(plan.rejected).toBe(true);
    expect(plan.rejectionReason).toMatch(/slippage rejection/i);
    expect(plan.plannedSpend).toBe(0);
  });

  it("fails closed on a wrong mint", () => {
    const plan = planBuyback(BASE_POLICY, { ...BASE_INPUT, observedCullerMint: "SomeOtherMint111111111111111111111111111" });
    expect(plan.rejected).toBe(true);
    expect(plan.rejectionReason).toMatch(/wrong \$?culler mint/i);
  });

  it("fails closed on a wrong destination/recipient", () => {
    const plan = planBuyback(BASE_POLICY, { ...BASE_INPUT, observedDestination: "SomeOtherDest1111111111111111111111111111" });
    expect(plan.rejected).toBe(true);
    expect(plan.rejectionReason).toMatch(/wrong destination/i);
  });

  it("fails closed on a wrong quote asset", () => {
    const plan = planBuyback(BASE_POLICY, { ...BASE_INPUT, feeAsset: "USDC" });
    expect(plan.rejected).toBe(true);
    expect(plan.rejectionReason).toMatch(/wrong quote asset/i);
  });

  it("fails closed on a wrong network (e.g. mainnet observed while the policy expects devnet)", () => {
    const plan = planBuyback(BASE_POLICY, { ...BASE_INPUT, observedNetwork: "mainnet-beta" });
    expect(plan.rejected).toBe(true);
    expect(plan.rejectionReason).toMatch(/wrong network/i);
  });

  it("rejects when there is no fee balance to work with", () => {
    const plan = planBuyback(BASE_POLICY, { ...BASE_INPUT, feeBalance: 0 });
    expect(plan.rejected).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const a = planBuyback(BASE_POLICY, BASE_INPUT);
    const b = planBuyback(BASE_POLICY, BASE_INPUT);
    expect(a).toEqual(b);
  });
});

describe("planAndRecordBuyback", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  it("durably logs both accepted and rejected dry-run plans, never executing anything", async () => {
    await planAndRecordBuyback(db, BASE_POLICY, BASE_INPUT);
    await planAndRecordBuyback(db, BASE_POLICY, { ...BASE_INPUT, observedNetwork: "mainnet-beta" });

    const runs = await listBuybackDryRuns(db);
    expect(runs).toHaveLength(2);
    expect(runs.some((r) => r.rejected)).toBe(true);
    expect(runs.some((r) => !r.rejected)).toBe(true);
  });

  it("a dry-run record is append-only (cannot be edited to pretend it was executed)", async () => {
    const record = await planAndRecordBuyback(db, BASE_POLICY, BASE_INPUT);
    await expect(db.query("UPDATE buyback_dry_runs SET rejected = true WHERE id = $1", [record.id])).rejects.toThrow(/append-only/i);
  });
});
