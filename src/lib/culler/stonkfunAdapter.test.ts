import { describe, expect, it } from "vitest";
import {
  assertStonkFunLaunchCanRepresentExistingSplitMint,
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
  creatorFeeBps: 0,
  creatorPayoutWallet: "CreatorWallet1111111111111111111111111111",
  tokenStandard: "token-2022",
  curveAllocation: 80,
  graduationBehavior: "RAYDIUM_LAUNCHLAB_BONDING_CURVE",
  claimMechanism: "AUTOMATIC_ON_GRADUATION",
  vestingTotalLockedAmount: 0,
  platformConfigAddress: "4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7",
};

describe("StonkFun adapter", () => {
  it("loads the real expected-config file from disk without throwing", () => {
    const config = loadExpectedStonkFunConfig();
    expect(config.quoteAsset).toBe("SOL");
    expect(config.tokenStandard).toBe("token-2022");
    expect(config.vestingTotalLockedAmount).toBe(0);
    expect(config.creatorFeeBps).toBe(0);
  });

  it("the real expected-config's own structural finding: StonkFun launches cannot represent an already-split mint", () => {
    expect(() => assertStonkFunLaunchCanRepresentExistingSplitMint()).toThrow(StonkFunAdapterError);
  });

  it("the real expected-config file still has unreviewed fields that fail closed against any observed value", () => {
    const expected = loadExpectedStonkFunConfig();
    const result = compareLaunchConfig(FULLY_REVIEWED, expected);
    // At least the fields that are still null in the committed config
    // (poolFeeBps, creatorPayoutWallet, curveAllocation, claimMechanism)
    // must be reported as mismatches, not silently pass. creatorFeeBps
    // and vestingTotalLockedAmount and tokenStandard ARE reviewed now
    // (Phase 6) and should match FULLY_REVIEWED exactly.
    expect(result.ok).toBe(false);
    expect(result.mismatches.some((m) => m.includes("poolFeeBps"))).toBe(true);
    expect(result.mismatches.some((m) => m.includes("creatorPayoutWallet"))).toBe(true);
    expect(result.mismatches.some((m) => m.includes("creatorFeeBps"))).toBe(false);
    expect(result.mismatches.some((m) => m.includes("vestingTotalLockedAmount"))).toBe(false);
  });

  it("passes when every field matches exactly", () => {
    const result = compareLaunchConfig(FULLY_REVIEWED, FULLY_REVIEWED);
    expect(result.ok).toBe(true);
    expect(result.mismatches).toEqual([]);
  });

  it("fails closed on a single differing field (e.g. token standard reverted to legacy SPL Token)", () => {
    const observed: StonkFunLaunchConfig = { ...FULLY_REVIEWED, tokenStandard: "spl-token" };
    const result = compareLaunchConfig(observed, FULLY_REVIEWED);
    expect(result.ok).toBe(false);
    expect(result.mismatches.some((m) => m.includes("tokenStandard"))).toBe(true);
  });

  it("fails closed if StonkFun ever starts whitelisting a non-zero vesting lock (would change the treasury-split finding)", () => {
    const observed: StonkFunLaunchConfig = { ...FULLY_REVIEWED, vestingTotalLockedAmount: 300_000_000 };
    const result = compareLaunchConfig(observed, FULLY_REVIEWED);
    expect(result.ok).toBe(false);
    expect(result.mismatches.some((m) => m.includes("vestingTotalLockedAmount"))).toBe(true);
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
