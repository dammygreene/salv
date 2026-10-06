import { describe, expect, it } from "vitest";
import { simulateEpochRewards, simulateWalletReward } from "./rewardSimulator";

describe("simulateEpochRewards", () => {
  it("splits the pool in exact proportion to points, summing exactly to the pool", () => {
    const result = simulateEpochRewards(1000, [
      { wallet: "A", points: 100 },
      { wallet: "B", points: 300 },
      { wallet: "C", points: 600 },
    ]);
    expect(result.totalValidPoints).toBe(1000);
    const byWallet = Object.fromEntries(result.allocations.map((a) => [a.wallet, a]));
    expect(byWallet.A.estimatedReward).toBeCloseTo(100);
    expect(byWallet.B.estimatedReward).toBeCloseTo(300);
    expect(byWallet.C.estimatedReward).toBeCloseTo(600);

    const total = result.allocations.reduce((sum, a) => sum + a.estimatedReward, 0);
    expect(total).toBe(1000);
  });

  it("gives a zero-point wallet exactly zero, never a rounding crumb", () => {
    const result = simulateEpochRewards(1_000_000, [
      { wallet: "Farmer", points: 999_999 },
      { wallet: "ZeroWallet", points: 0 },
    ]);
    const zero = result.allocations.find((a) => a.wallet === "ZeroWallet")!;
    expect(zero.estimatedReward).toBe(0);
    expect(zero.share).toBe(0);
  });

  it("handles zero total points across all wallets: everyone gets 0, nothing is distributed", () => {
    const result = simulateEpochRewards(500_000, [
      { wallet: "A", points: 0 },
      { wallet: "B", points: 0 },
    ]);
    expect(result.totalValidPoints).toBe(0);
    expect(result.allocations.every((a) => a.estimatedReward === 0)).toBe(true);
  });

  it("handles an empty wallet list", () => {
    const result = simulateEpochRewards(500_000, []);
    expect(result.totalValidPoints).toBe(0);
    expect(result.allocations).toEqual([]);
  });

  it("handles a non-positive reward pool: every allocation is 0 regardless of points", () => {
    const result = simulateEpochRewards(0, [{ wallet: "A", points: 100 }]);
    expect(result.allocations[0].estimatedReward).toBe(0);

    const negative = simulateEpochRewards(-500, [{ wallet: "A", points: 100 }]);
    expect(negative.allocations[0].estimatedReward).toBe(0);
  });

  it("the sum of allocations never exceeds the reward pool across many wallets with awkward (non-dividing) point ratios", () => {
    const wallets = Array.from({ length: 777 }, (_, i) => ({ wallet: `w${i}`, points: (i % 13) + 1 }));
    const result = simulateEpochRewards(1_234_567, wallets);
    const total = result.allocations.reduce((sum, a) => sum + a.estimatedReward, 0);
    expect(total).toBeLessThanOrEqual(1_234_567);
    expect(total).toBeCloseTo(1_234_567, 6);
  });

  it("floors negative/garbage point values defensively instead of producing negative shares", () => {
    const result = simulateEpochRewards(1000, [
      { wallet: "A", points: -50 },
      { wallet: "B", points: 100 },
    ]);
    const a = result.allocations.find((x) => x.wallet === "A")!;
    expect(a.points).toBe(0);
    expect(a.estimatedReward).toBe(0);
  });

  it("is deterministic: calling it twice with the same input gives byte-identical output", () => {
    const wallets = [
      { wallet: "A", points: 37 },
      { wallet: "B", points: 41 },
      { wallet: "C", points: 5 },
    ];
    const r1 = simulateEpochRewards(10_000, wallets);
    const r2 = simulateEpochRewards(10_000, wallets);
    expect(r1).toEqual(r2);
  });

  it("handles one heavy farmer holding almost all the points (large concentration) without numeric blowup", () => {
    const wallets = [
      { wallet: "whale", points: 99_000_000 },
      ...Array.from({ length: 999 }, (_, i) => ({ wallet: `small${i}`, points: 1_001 })),
    ];
    const result = simulateEpochRewards(1_000_000, wallets);
    const whale = result.allocations.find((a) => a.wallet === "whale")!;
    expect(whale.share).toBeGreaterThan(0.98);
    const total = result.allocations.reduce((sum, a) => sum + a.estimatedReward, 0);
    expect(total).toBeCloseTo(1_000_000, 6);
    expect(total).toBeLessThanOrEqual(1_000_000 + 1e-6);
  });
});

describe("simulateWalletReward", () => {
  it("matches the plain proportional formula", () => {
    expect(simulateWalletReward(250, 1000, 10_000)).toBeCloseTo(2500);
  });

  it("returns 0 for zero total points, zero wallet points, or a non-positive pool", () => {
    expect(simulateWalletReward(100, 0, 10_000)).toBe(0);
    expect(simulateWalletReward(0, 1000, 10_000)).toBe(0);
    expect(simulateWalletReward(100, 1000, 0)).toBe(0);
  });
});
