import { describe, expect, it } from "vitest";
import {
  compareLaunchConfig,
  fetchLiveStonkFunConfig,
  loadExpectedStonkFunConfig,
  StonkFunAdapterError,
  StonkFunLaunchConfig,
  verifyBeforeLaunch,
} from "./stonkfunAdapter";

const FULLY_REVIEWED: StonkFunLaunchConfig = {
  launchType: "STANDARD",
  quoteAsset: "SOL",
  poolFeeBps: 100,
  creatorFeeBps: 50,
  creatorPayoutWallet: "CreatorWallet1111111111111111111111111111",
  tokenStandard: "spl-token",
  curveAllocation: 80,
  graduationBehavior: "RAYDIUM_LAUNCHLAB_BONDING_CURVE",
  claimMechanism: "AUTOMATIC_ON_GRADUATION",
};

describe("StonkFun adapter", () => {
  it("loads the real expected-config file from disk without throwing", () => {
    const config = loadExpectedStonkFunConfig();
    expect(config.quoteAsset).toBe("SOL");
    expect(config.tokenStandard).toBe("spl-token");
  });

  it("the real expected-config file has not been reviewed yet, so every unreviewed field fails closed against any observed value", () => {
    const expected = loadExpectedStonkFunConfig();
    const result = compareLaunchConfig(FULLY_REVIEWED, expected);
    // At least the fields that are still null in the committed config
    // (poolFeeBps, creatorFeeBps, creatorPayoutWallet, curveAllocation,
    // claimMechanism) must be reported as mismatches, not silently pass.
    expect(result.ok).toBe(false);
    expect(result.mismatches.some((m) => m.includes("poolFeeBps"))).toBe(true);
    expect(result.mismatches.some((m) => m.includes("creatorFeeBps"))).toBe(true);
  });

  it("passes when every field matches exactly", () => {
    const result = compareLaunchConfig(FULLY_REVIEWED, FULLY_REVIEWED);
    expect(result.ok).toBe(true);
    expect(result.mismatches).toEqual([]);
  });

  it("fails closed on a single differing field (e.g. token standard changed to Token-2022)", () => {
    const observed: StonkFunLaunchConfig = { ...FULLY_REVIEWED, tokenStandard: "token-2022" };
    const result = compareLaunchConfig(observed, FULLY_REVIEWED);
    expect(result.ok).toBe(false);
    expect(result.mismatches.some((m) => m.includes("tokenStandard"))).toBe(true);
  });

  it("verifyBeforeLaunch throws StonkFunAdapterError on any mismatch, never proceeding", async () => {
    const observedDifferent: StonkFunLaunchConfig = { ...FULLY_REVIEWED, creatorFeeBps: 999 };
    await expect(verifyBeforeLaunch(async () => observedDifferent, FULLY_REVIEWED)).rejects.toBeInstanceOf(StonkFunAdapterError);
  });

  it("verifyBeforeLaunch resolves with the observed config when everything matches", async () => {
    const result = await verifyBeforeLaunch(async () => FULLY_REVIEWED, FULLY_REVIEWED);
    expect(result).toEqual(FULLY_REVIEWED);
  });

  it("the real network fetcher is not implemented and throws clearly rather than returning fabricated data", async () => {
    await expect(fetchLiveStonkFunConfig()).rejects.toBeInstanceOf(StonkFunAdapterError);
  });
});
