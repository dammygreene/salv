import { describe, expect, it } from "vitest";
import { Asset } from "@/lib/types";
import { buildSalvageTransactionPlan, PlanningError } from "./planner";

function salvageableAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "acct-1",
    name: "Empty USDC account",
    ticker: "USDC",
    kind: "ACCOUNT",
    address: "abcd...wxyz",
    status: "SALVAGEABLE",
    age: "2d ago",
    value: "0.0020 SOL",
    valueKnown: true,
    reason: "Empty token account can be closed to recover rent.",
    action: "CLOSE ACCOUNT",
    tokenAccount: "TokenAccountAddress1111111111111111111111",
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    lamports: 2_039_280,
    ...overrides,
  };
}

const WALLET = "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T";

describe("buildSalvageTransactionPlan", () => {
  it("throws when no assets are provided", () => {
    expect(() =>
      buildSalvageTransactionPlan({ wallet: WALLET, network: "mainnet-beta", assets: [], estimatedFeeLamports: 5000 })
    ).toThrow(PlanningError);
  });

  it("builds a plan with one CLOSE_TOKEN_ACCOUNT action per eligible asset", () => {
    const plan = buildSalvageTransactionPlan({
      wallet: WALLET,
      network: "mainnet-beta",
      assets: [salvageableAsset()],
      estimatedFeeLamports: 5000,
    });
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].type).toBe("CLOSE_TOKEN_ACCOUNT");
    expect(plan.actions[0].tokenAccount).toBe("TokenAccountAddress1111111111111111111111");
    expect(plan.totalExpectedRecoveryLamports).toBe(2_039_280);
  });

  it("rejects an asset that is not SALVAGEABLE", () => {
    expect(() =>
      buildSalvageTransactionPlan({
        wallet: WALLET,
        network: "mainnet-beta",
        assets: [salvageableAsset({ status: "KEEP" })],
        estimatedFeeLamports: 5000,
      })
    ).toThrow(PlanningError);
  });

  it("rejects an asset that is not an ACCOUNT kind (e.g. a watched NFT)", () => {
    expect(() =>
      buildSalvageTransactionPlan({
        wallet: WALLET,
        network: "mainnet-beta",
        assets: [salvageableAsset({ kind: "NFT", status: "SALVAGEABLE" })],
        estimatedFeeLamports: 5000,
      })
    ).toThrow(PlanningError);
  });

  it("rejects an asset missing on-chain identifiers instead of silently skipping it", () => {
    expect(() =>
      buildSalvageTransactionPlan({
        wallet: WALLET,
        network: "mainnet-beta",
        assets: [salvageableAsset({ tokenAccount: undefined })],
        estimatedFeeLamports: 5000,
      })
    ).toThrow(PlanningError);
  });

  it("is deterministic: selection order never changes the resulting action order", () => {
    const a = salvageableAsset({ id: "a", tokenAccount: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" });
    const b = salvageableAsset({ id: "b", tokenAccount: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" });

    const planForward = buildSalvageTransactionPlan({
      wallet: WALLET,
      network: "mainnet-beta",
      assets: [a, b],
      estimatedFeeLamports: 5000,
    });
    const planReversed = buildSalvageTransactionPlan({
      wallet: WALLET,
      network: "mainnet-beta",
      assets: [b, a],
      estimatedFeeLamports: 5000,
    });

    expect(planForward.actions.map((x) => x.tokenAccount)).toEqual(planReversed.actions.map((x) => x.tokenAccount));
    expect(planForward.actions[0].tokenAccount).toBe("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  });

  it("sums total expected recovery across multiple actions", () => {
    const plan = buildSalvageTransactionPlan({
      wallet: WALLET,
      network: "mainnet-beta",
      assets: [
        salvageableAsset({ id: "a", tokenAccount: "A".repeat(43), lamports: 1_000_000 }),
        salvageableAsset({ id: "b", tokenAccount: "B".repeat(43), lamports: 2_000_000 }),
      ],
      estimatedFeeLamports: 5000,
    });
    expect(plan.totalExpectedRecoveryLamports).toBe(3_000_000);
    expect(plan.estimatedFeeLamports).toBe(5000);
  });
});
