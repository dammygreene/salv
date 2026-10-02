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
  };
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
