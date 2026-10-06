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

/**
 * Phase 6 decision (supersedes Phase 5's "standard SPL Token" choice,
 * which was based on an outdated assumption about StonkFun's launch
 * path): the SPL **Token-2022** program, base58-encoded, with zero
 * extensions enabled (no transfer fee, no permanent delegate, no
 * transfer hook, no confidential transfers). Verified against
 * StonkFun's own currently-documented on-chain platform configs (see
 * docs/token-spec.md's "Token program" section and
 * docs/phase-6-status.md for citations): StonkFun's standard-launch
 * platform config (`4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7`) mints
 * Token-2022 tokens without a transfer fee extension -- not the legacy
 * SPL Token program. A bare Token-2022 mint with no extensions behaves
 * identically to a legacy SPL Token mint for every operation this
 * project performs (mint once, transfer, transferChecked, burnChecked,
 * multisig authorities); this constant is a plain string (not a
 * `PublicKey`) so this module stays dependency-free -- callers that
 * need a `PublicKey` construct one with
 * `new PublicKey(TOKEN_PROGRAM_ID_BASE58)`.
 */
export const TOKEN_PROGRAM_ID_BASE58 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

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

/**
 * The inverse of `salvToBaseUnits`, rendered as a fixed-point decimal
 * STRING using only bigint arithmetic — never `Number()`/floating point
 * anywhere in this function. This is the precision rule anything that
 * needs to durably record (not just display) a $SALV amount should use
 * (e.g. the reward allocation ledger's CSV export, docs/salv-reward-
 * ledger.md) instead of the various `baseUnitsToSalvNumber` display-only
 * helpers scattered across the API routes, which are a `number` and
 * therefore unsafe once a value could ever approach 2^53 (never true for
 * this codebase's own 300,000,000 SALV cap, but a ledger that mirrors
 * raw base units from the database should not depend on that ceiling
 * holding forever).
 */
export function baseUnitsToSalvDecimalString(amountBaseUnits: bigint): string {
  const negative = amountBaseUnits < 0n;
  const magnitude = negative ? -amountBaseUnits : amountBaseUnits;
  const whole = magnitude / BASE_UNIT_FACTOR;
  const fraction = (magnitude % BASE_UNIT_FACTOR).toString().padStart(TOKEN_DECIMALS, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
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
