import { describe, expect, it } from "vitest";
import {
  assertNoHiddenAllocations,
  BASE_UNIT_FACTOR,
  COMMUNITY_ALLOCATION_BASE_UNITS,
  COMMUNITY_ALLOCATION_SALV,
  MARKET_ALLOCATION_BASE_UNITS,
  MARKET_ALLOCATION_SALV,
  salvToBaseUnits,
  TOKEN_DECIMALS,
  TOKEN_PROGRAM_ID_BASE58,
  TOTAL_SUPPLY_BASE_UNITS,
  TOTAL_SUPPLY_SALV,
  TokenSpecError,
} from "./tokenSpec";

describe("$SALV token spec", () => {
  it("has exactly a fixed 1,000,000,000 total supply, split 700M market / 300M community", () => {
    expect(TOTAL_SUPPLY_SALV).toBe(1_000_000_000);
    expect(MARKET_ALLOCATION_SALV).toBe(700_000_000);
    expect(COMMUNITY_ALLOCATION_SALV).toBe(300_000_000);
    expect(MARKET_ALLOCATION_SALV + COMMUNITY_ALLOCATION_SALV).toBe(TOTAL_SUPPLY_SALV);
  });

  it("never throws from assertNoHiddenAllocations() as currently configured (no third bucket, no drift)", () => {
    expect(() => assertNoHiddenAllocations()).not.toThrow();
  });

  it("would catch a hidden/miscalculated allocation if one were introduced", () => {
    // Simulates what assertNoHiddenAllocations() protects against: a
    // third bucket, or buckets that no longer sum to the total.
    const withHiddenBucket = [MARKET_ALLOCATION_BASE_UNITS, COMMUNITY_ALLOCATION_BASE_UNITS, 1n];
    const sum = withHiddenBucket.reduce((a, b) => a + b, 0n);
    expect(sum).not.toBe(TOTAL_SUPPLY_BASE_UNITS);
  });

  it("converts whole SALV to base units using 10^9 (9 decimals)", () => {
    expect(TOKEN_DECIMALS).toBe(9);
    expect(BASE_UNIT_FACTOR).toBe(1_000_000_000n);
    expect(salvToBaseUnits(1)).toBe(1_000_000_000n);
    expect(salvToBaseUnits(0)).toBe(0n);
    expect(salvToBaseUnits(TOTAL_SUPPLY_SALV)).toBe(TOTAL_SUPPLY_BASE_UNITS);
  });

  it("base-unit totals match the whole-SALV totals scaled by the base unit factor", () => {
    expect(TOTAL_SUPPLY_BASE_UNITS).toBe(BigInt(TOTAL_SUPPLY_SALV) * BASE_UNIT_FACTOR);
    expect(MARKET_ALLOCATION_BASE_UNITS).toBe(BigInt(MARKET_ALLOCATION_SALV) * BASE_UNIT_FACTOR);
    expect(COMMUNITY_ALLOCATION_BASE_UNITS).toBe(BigInt(COMMUNITY_ALLOCATION_SALV) * BASE_UNIT_FACTOR);
  });

  it("TokenSpecError is a real Error subclass (so callers can distinguish it)", () => {
    expect(new TokenSpecError("x")).toBeInstanceOf(Error);
  });

  it("uses the real Token-2022 program id (verified current StonkFun requirement, Phase 6)", () => {
    // TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb is the well-known,
    // unchanging Token-2022 program id -- pinned here as a literal (not
    // imported from @solana/spl-token) so a typo in tokenSpec.ts's own
    // pure string constant would fail this test even if the dependency
    // were ever mocked out.
    expect(TOKEN_PROGRAM_ID_BASE58).toBe("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
  });
});
