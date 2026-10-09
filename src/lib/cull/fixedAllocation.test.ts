import { describe, expect, it } from "vitest";
import { calculateFixedAllocationBaseUnits } from "./fixedAllocation";

describe("calculateFixedAllocationBaseUnits", () => {
  it("uses only wallet points and the fixed conversion rate", () => {
    expect(calculateFixedAllocationBaseUnits(100, 100n)).toBe(10_000n * 1_000_000_000n);
    expect(calculateFixedAllocationBaseUnits(750, 100n)).toBe(75_000n * 1_000_000_000n);
    expect(calculateFixedAllocationBaseUnits(1_000, 100n)).toBe(100_000n * 1_000_000_000n);
  });

  it("is independent of scan order and preserves exact integer arithmetic", () => {
    const a = calculateFixedAllocationBaseUnits(750, 100n);
    const b = calculateFixedAllocationBaseUnits(250, 100n);
    expect(a).toBe(75_000_000_000_000n);
    expect(b).toBe(25_000_000_000_000n);
    expect(calculateFixedAllocationBaseUnits(750, 100n)).toBe(a);
    expect(() => calculateFixedAllocationBaseUnits(1, 0n)).toThrow("positive integer");
  });
});
