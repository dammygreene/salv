/**
 * $SALV token specification constants. This is the single source of
 * truth for name/symbol/supply/decimals/allocations in code — see
 * docs/token-spec.md for the authoritative written spec (if they ever
 * disagree, the doc is correct and this file has a bug). No network or
 * database access here; everything in this module is a pure constant or
 * a pure function over those constants.
 */

export const TOKEN_NAME = "SALVAGE";
export const TOKEN_SYMBOL = "SALV";
export const TOKEN_DECIMALS = 9;

export const TOTAL_SUPPLY_SALV = 1_000_000_000;
export const MARKET_ALLOCATION_SALV = 700_000_000;
export const COMMUNITY_ALLOCATION_SALV = 300_000_000;

/** 10^decimals, as a bigint — the conversion factor between whole SALV
 * and base units (the integer unit the SPL Token program actually
 * stores and transfers). */
export const BASE_UNIT_FACTOR = 10n ** BigInt(TOKEN_DECIMALS);

export function salvToBaseUnits(amountSalv: number | bigint): bigint {
  const whole = typeof amountSalv === "bigint" ? amountSalv : BigInt(Math.trunc(amountSalv));
  return whole * BASE_UNIT_FACTOR;
}

export const TOTAL_SUPPLY_BASE_UNITS = salvToBaseUnits(TOTAL_SUPPLY_SALV);
export const MARKET_ALLOCATION_BASE_UNITS = salvToBaseUnits(MARKET_ALLOCATION_SALV);
export const COMMUNITY_ALLOCATION_BASE_UNITS = salvToBaseUnits(COMMUNITY_ALLOCATION_SALV);

export class TokenSpecError extends Error {}

/**
 * Asserts the only two allocation buckets that exist sum exactly to the
 * declared total supply, with no third bucket, no rounding slop, and no
 * bucket exceeding the total on its own. This is the enforcement
 * mechanism behind "no hidden allocations" — a unit test calls this on
 * every run, so an accidental or intentional third allocation constant
 * added anywhere in this module (and wired into this function) fails CI
 * immediately instead of silently shipping.
 */
export function assertNoHiddenAllocations(): void {
  const buckets = [MARKET_ALLOCATION_BASE_UNITS, COMMUNITY_ALLOCATION_BASE_UNITS];
  const sum = buckets.reduce((acc, b) => acc + b, 0n);
  if (sum !== TOTAL_SUPPLY_BASE_UNITS) {
    throw new TokenSpecError(
      `$SALV allocation buckets sum to ${sum} base units, expected exactly ${TOTAL_SUPPLY_BASE_UNITS} ` +
        `(${TOTAL_SUPPLY_SALV} SALV). This means an allocation was added, removed, or miscalculated — ` +
        `see docs/token-spec.md.`
    );
  }
  for (const b of buckets) {
    if (b < 0n || b > TOTAL_SUPPLY_BASE_UNITS) {
      throw new TokenSpecError(`$SALV allocation bucket ${b} is out of range [0, ${TOTAL_SUPPLY_BASE_UNITS}].`);
    }
  }
}
