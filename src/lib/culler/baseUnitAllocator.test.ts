import { describe, expect, it } from "vitest";
import { allocateRewardBaseUnits } from "./baseUnitAllocator";

describe("allocateRewardBaseUnits", () => {
  it("splits a pool proportional to points, with the sum of allocations + dust exactly equal to the pool", () => {
    const result = allocateRewardBaseUnits(1000n, [
      { wallet: "A", points: 100 },
      { wallet: "B", points: 300 },
      { wallet: "C", points: 600 },
    ]);
    const byWallet = Object.fromEntries(result.allocations.map((a) => [a.wallet, a.allocationBaseUnits]));
    expect(byWallet.A).toBe(100n);
    expect(byWallet.B).toBe(300n);
    expect(byWallet.C).toBe(600n);
    expect(result.dustBaseUnits).toBe(0n);
  });

  it("never distributes more than the pool, and dust absorbs the floor-rounding remainder for awkward ratios", () => {
    // 1000 split 3 ways by equal points (333.33... each) cannot divide evenly.
    const result = allocateRewardBaseUnits(1000n, [
      { wallet: "A", points: 1 },
      { wallet: "B", points: 1 },
      { wallet: "C", points: 1 },
    ]);
    const total = result.allocations.reduce((sum, a) => sum + a.allocationBaseUnits, 0n);
    expect(total).toBeLessThanOrEqual(1000n);
    expect(total + result.dustBaseUnits).toBe(1000n);
    // Every wallet gets the same floored share; none gets a stray extra unit.
    expect(new Set(result.allocations.map((a) => a.allocationBaseUnits.toString())).size).toBe(1);
    expect(result.dustBaseUnits).toBe(1n); // 999 distributed (333*3), 1 left as documented dust
  });

  it("gives a zero-point wallet exactly 0n, never a rounding crumb", () => {
    const result = allocateRewardBaseUnits(1_000_000_000n, [
      { wallet: "Farmer", points: 999_999 },
      { wallet: "ZeroWallet", points: 0 },
    ]);
    const zero = result.allocations.find((a) => a.wallet === "ZeroWallet")!;
    expect(zero.allocationBaseUnits).toBe(0n);
  });

  it("handles zero total points: everyone gets 0n and all of the pool becomes dust (nothing valid to proportion against)", () => {
    const result = allocateRewardBaseUnits(500_000n, [
      { wallet: "A", points: 0 },
      { wallet: "B", points: 0 },
    ]);
    expect(result.totalValidPoints).toBe(0);
    expect(result.allocations.every((a) => a.allocationBaseUnits === 0n)).toBe(true);
    expect(result.dustBaseUnits).toBe(500_000n);
  });

  it("handles an empty wallet list", () => {
    const result = allocateRewardBaseUnits(500_000n, []);
    expect(result.allocations).toEqual([]);
    expect(result.dustBaseUnits).toBe(500_000n);
  });

  it("handles a non-positive pool: everything is 0, no negative dust", () => {
    const zero = allocateRewardBaseUnits(0n, [{ wallet: "A", points: 100 }]);
    expect(zero.allocations[0].allocationBaseUnits).toBe(0n);
    expect(zero.dustBaseUnits).toBe(0n);

    const negative = allocateRewardBaseUnits(-500n, [{ wallet: "A", points: 100 }]);
    expect(negative.allocations[0].allocationBaseUnits).toBe(0n);
    expect(negative.dustBaseUnits).toBe(0n);
  });

  it("floors negative/garbage point values defensively instead of a negative share", () => {
    const result = allocateRewardBaseUnits(1000n, [
      { wallet: "A", points: -50 },
      { wallet: "B", points: 100 },
    ]);
    const a = result.allocations.find((x) => x.wallet === "A")!;
    expect(a.points).toBe(0);
    expect(a.allocationBaseUnits).toBe(0n);
    const b = result.allocations.find((x) => x.wallet === "B")!;
    expect(b.allocationBaseUnits).toBe(1000n);
  });

  it("is deterministic: calling it twice with the same input gives identical output", () => {
    const wallets = [
      { wallet: "A", points: 37 },
      { wallet: "B", points: 41 },
      { wallet: "C", points: 5 },
    ];
    const r1 = allocateRewardBaseUnits(10_000n, wallets);
    const r2 = allocateRewardBaseUnits(10_000n, wallets);
    expect(r1).toEqual(r2);
  });

  it("handles a huge, realistic 1B-supply-scale pool across many wallets without any floating-point drift", () => {
    // 300,000,000 CULLER at 9 decimals = 3 * 10^17 base units -- comfortably
    // outside safe floating-point integer range (2^53 ~ 9*10^15), which is
    // exactly why this module is bigint-only.
    const pool = 300_000_000n * 1_000_000_000n;
    const wallets = Array.from({ length: 1000 }, (_, i) => ({ wallet: `w${i}`, points: (i % 97) + 1 }));
    const result = allocateRewardBaseUnits(pool, wallets);
    const total = result.allocations.reduce((sum, a) => sum + a.allocationBaseUnits, 0n);
    expect(total).toBeLessThanOrEqual(pool);
    expect(total + result.dustBaseUnits).toBe(pool);
    expect(result.dustBaseUnits).toBeGreaterThanOrEqual(0n);
    expect(result.dustBaseUnits).toBeLessThan(BigInt(wallets.length)); // dust is at most ~1 unit per wallet
  });

  it("handles one heavy wallet holding almost all the points (large concentration) without overshooting the pool", () => {
    const wallets = [
      { wallet: "whale", points: 99_000_000 },
      ...Array.from({ length: 999 }, (_, i) => ({ wallet: `small${i}`, points: 1_001 })),
    ];
    const result = allocateRewardBaseUnits(1_000_000_000n, wallets);
    const whale = result.allocations.find((a) => a.wallet === "whale")!;
    expect(whale.allocationBaseUnits).toBeGreaterThan(980_000_000n);
    const total = result.allocations.reduce((sum, a) => sum + a.allocationBaseUnits, 0n);
    expect(total).toBeLessThanOrEqual(1_000_000_000n);
  });
});
