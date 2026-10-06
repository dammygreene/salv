import { describe, expect, it } from "vitest";
import { computeClaimAmountBaseUnits } from "./claimAmount";
import { BASE_UNIT_FACTOR } from "./tokenSpec";

describe("computeClaimAmountBaseUnits", () => {
  it("computes the exact proportional share in base units for a simple case", () => {
    const amount = computeClaimAmountBaseUnits({ points: 100, totalPoints: 1000, rewardPool: 1000 });
    expect(amount).toBe(100n * BASE_UNIT_FACTOR); // 10% of a 1000 CULLER pool = 100 CULLER
  });

  it("gives a zero-point wallet exactly 0n", () => {
    expect(computeClaimAmountBaseUnits({ points: 0, totalPoints: 1000, rewardPool: 1000 })).toBe(0n);
  });

  it("gives 0n for zero total points (nothing to proportion against)", () => {
    expect(computeClaimAmountBaseUnits({ points: 0, totalPoints: 0, rewardPool: 1000 })).toBe(0n);
  });

  it("gives 0n for a non-positive reward pool", () => {
    expect(computeClaimAmountBaseUnits({ points: 100, totalPoints: 1000, rewardPool: 0 })).toBe(0n);
    expect(computeClaimAmountBaseUnits({ points: 100, totalPoints: 1000, rewardPool: -5 })).toBe(0n);
  });

  it("floors instead of rounding up for an awkward (non-dividing) ratio", () => {
    // 1 / 3 of a 1000 CULLER pool = 333.33... CULLER -> floors to 333.333333333 CULLER in base units
    const amount = computeClaimAmountBaseUnits({ points: 1, totalPoints: 3, rewardPool: 1000 });
    const expected = (1000n * BASE_UNIT_FACTOR * 1n) / 3n;
    expect(amount).toBe(expected);
    expect(amount).toBeLessThan((1000n * BASE_UNIT_FACTOR) / 3n + 1n);
  });

  it("never exceeds the pool for a single dominant wallet (large concentration)", () => {
    const amount = computeClaimAmountBaseUnits({ points: 999_999, totalPoints: 1_000_000, rewardPool: 1_000_000 });
    expect(amount).toBeLessThan(1_000_000n * BASE_UNIT_FACTOR);
  });

  it("is deterministic across repeated calls with the same frozen snapshot values", () => {
    const snapshot = { points: 42, totalPoints: 777, rewardPool: 250_000 };
    const a = computeClaimAmountBaseUnits(snapshot);
    const b = computeClaimAmountBaseUnits(snapshot);
    expect(a).toBe(b);
  });

  it("handles a realistic full community-allocation-scale pool without precision loss", () => {
    // A single epoch pool of 1,000,000 CULLER (well within the 300M community
    // allocation spread across many epochs) at 9 decimals comfortably
    // exceeds Number.MAX_SAFE_INTEGER once converted to base units.
    const amount = computeClaimAmountBaseUnits({ points: 1, totalPoints: 2, rewardPool: 1_000_000 });
    expect(amount).toBe(500_000n * BASE_UNIT_FACTOR);
  });
});
