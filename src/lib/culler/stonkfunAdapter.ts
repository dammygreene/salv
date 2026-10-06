import "server-only";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * StonkFun launch configuration inspection adapter (Phase 5 Section 12).
 * This module never launches anything — it only fetches and compares
 * configuration. Nothing in this file or called by it submits a launch
 * transaction.
 */

export interface StonkFunLaunchConfig {
  launchType: string;
  quoteAsset: string;
  poolFeeBps: number | null;
  creatorFeeBps: number | null;
  creatorPayoutWallet: string | null;
  tokenStandard: string;
  curveAllocation: number | null;
  graduationBehavior: string;
  claimMechanism: string | null;
  /**
   * Phase 6: the platform's whitelisted `total_locked_amount` (Raydium
   * LaunchLab vesting). StonkFun's own current standard-launch config is
   * verified (see config/stonkfun-expected-launch-config.json) to
   * whitelist only `0` here -- not Raydium's wildcard sentinel
   * (`u64::MAX`) -- meaning vesting/reserved allocations are explicitly
   * disabled for StonkFun launches, not merely unconfigured. A non-zero
   * observed value would mean StonkFun's config changed and must be
   * re-reviewed before assuming a reserved-allocation launch is
   * possible; this field alone never implies the $CULLER treasury split
   * can be expressed through a LaunchLab transaction -- see
   * docs/culler-treasury.md.
   */
  vestingTotalLockedAmount: number | null;
  /** The on-chain PlatformConfig account address this launch would use. */
  platformConfigAddress: string | null;
}

export class StonkFunAdapterError extends Error {}

export interface ConfigComparisonResult {
  ok: boolean;
  mismatches: string[];
}

const COMPARABLE_FIELDS: (keyof StonkFunLaunchConfig)[] = [
  "launchType",
  "quoteAsset",
  "poolFeeBps",
  "creatorFeeBps",
  "creatorPayoutWallet",
  "tokenStandard",
  "curveAllocation",
  "graduationBehavior",
  "claimMechanism",
  "vestingTotalLockedAmount",
  "platformConfigAddress",
];

/**
 * Compares a freshly observed StonkFun configuration against the
 * expected one. A `null` field in `expected` means "not yet reviewed /
 * unknown" and is treated as automatically mismatching (fail closed —
 * an unreviewed field can never silently pass as "fine"), not as a
 * wildcard that matches anything.
 */
export function compareLaunchConfig(observed: StonkFunLaunchConfig, expected: StonkFunLaunchConfig): ConfigComparisonResult {
  const mismatches: string[] = [];
  for (const field of COMPARABLE_FIELDS) {
    const expectedValue = expected[field];
    const observedValue = observed[field];
    if (expectedValue === null) {
      mismatches.push(`${field}: not yet reviewed (expected is null) -- cannot verify against observed value "${observedValue}".`);
      continue;
    }
    if (expectedValue !== observedValue) {
      mismatches.push(`${field}: expected "${expectedValue}", observed "${observedValue}".`);
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

/**
 * Loads the reviewed "expected" launch configuration from
 * config/stonkfun-expected-launch-config.json. This is deliberately a
 * data file, not a hardcoded object in this module, so that no fee
 * percentage or wallet address is ever silently baked into application
 * logic — see that file's own comment for the review workflow.
 */
export function loadExpectedStonkFunConfig(): StonkFunLaunchConfig {
  const path = join(process.cwd(), "config", "stonkfun-expected-launch-config.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return {
    launchType: raw.launchType,
    quoteAsset: raw.quoteAsset,
    poolFeeBps: raw.poolFeeBps,
    creatorFeeBps: raw.creatorFeeBps,
    creatorPayoutWallet: raw.creatorPayoutWallet,
    tokenStandard: raw.tokenStandard,
    curveAllocation: raw.curveAllocation,
    graduationBehavior: raw.graduationBehavior,
    claimMechanism: raw.claimMechanism,
    vestingTotalLockedAmount: raw.vestingTotalLockedAmount ?? null,
    platformConfigAddress: raw.platformConfigAddress ?? null,
  };
}

/**
 * Phase 6: a $CULLER-specific, additional gate on top of
 * `compareLaunchConfig`'s generic field-by-field comparison. Even if
 * every field in `COMPARABLE_FIELDS` matched exactly, a real StonkFun/
 * LaunchLab launch transaction mints its own, brand-new total supply as
 * part of a single instruction -- it cannot "launch" only a portion of
 * an already-separately-minted, already-split $CULLER supply. This
 * function makes that structural incompatibility an explicit, testable
 * refusal rather than something only described in a doc comment: it
 * always rejects, naming the exact reason, because this codebase has no
 * supported way to reconcile "$CULLER already exists as one 1,000,000,000
 * fixed-supply mint with 300M already transferred to the treasury" with
 * "LaunchLab mints the declared total_supply itself." See
 * docs/culler-treasury.md for the chosen alternative (the 300M/700M split
 * happens entirely outside of any LaunchLab transaction).
 */
export function assertStonkFunLaunchCanRepresentExistingSplitMint(): never {
  throw new StonkFunAdapterError(
    "Refusing to build a StonkFun/LaunchLab launch transaction for an already-minted, already-split $CULLER supply: " +
      "Raydium LaunchLab's `initialize` instruction always mints the entire declared total_supply itself as part of " +
      "one launch transaction (see docs.raydium.io/products/launchlab/platform-config) -- it has no parameter for " +
      "\"only launch this existing mint's 700,000,000-token market tranche, the other 300,000,000 already live " +
      "elsewhere.\" $CULLER's fixed 1,000,000,000 supply and 300M/700M split are therefore implemented entirely " +
      "outside of any real StonkFun/LaunchLab transaction (see docs/culler-treasury.md); this function exists so no " +
      "future code path can silently assume otherwise."
  );
}

export type StonkFunConfigFetcher = () => Promise<StonkFunLaunchConfig>;

/**
 * Fetches StonkFun's current live configuration and verifies it against
 * the reviewed expectation, throwing StonkFunAdapterError (fail closed)
 * on any mismatch — including every still-unreviewed field, since this
 * phase has not performed that review. `fetchLive` is injected so this
 * can be exercised in tests without a real network call; the default
 * implementation (buildHttpStonkFunFetcher) requires real outbound
 * network access, which this sandbox does not have (the same constraint
 * documented for Phase 4 Part A).
 */
export async function verifyBeforeLaunch(fetchLive: StonkFunConfigFetcher, expected = loadExpectedStonkFunConfig()): Promise<StonkFunLaunchConfig> {
  const observed = await fetchLive();
  const result = compareLaunchConfig(observed, expected);
  if (!result.ok) {
    throw new StonkFunAdapterError(
      `Refusing to launch: observed StonkFun configuration differs from the reviewed expectation.\n${result.mismatches.join("\n")}`
    );
  }
  return observed;
}

/**
 * A real fetcher stub for the live StonkFun API/on-chain program. Not
 * implemented against a real endpoint yet — StonkFun's current public
 * API surface for programmatic launch-config inspection has not been
 * integrated in this phase (no launch is happening in this phase; see
 * launch.md). Calling this throws clearly rather than silently
 * returning fabricated data.
 */
export const fetchLiveStonkFunConfig: StonkFunConfigFetcher = async () => {
  throw new StonkFunAdapterError(
    "fetchLiveStonkFunConfig is not implemented: no real StonkFun API integration has been built in this phase, and this " +
      "sandbox has no outbound network access to query one even if it had. A real integration must be built and manually " +
      "reviewed (updating config/stonkfun-expected-launch-config.json) before this function is ever used ahead of a real launch."
  );
};
