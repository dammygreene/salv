import "server-only";

/**
 * $CULLER community treasury multisig configuration (Phase 6).
 *
 * This module is deliberately tiny and deliberately boring: it reads
 * four pieces of **public** information (a multisig account address,
 * three member public keys, and which network they apply to) from
 * environment variables, validates them, and returns them. It never
 * reads, stores, generates, or even has a shape for a private key —
 * there is no function in this file that could return one, by
 * construction, not just by convention.
 *
 * Why this is safe to be server-only but still "just config": the
 * values here are not secrets (every one of them is public on-chain
 * information, visible to anyone who looks up the multisig account),
 * but they are still integrity-sensitive — a compromised client bundle
 * must never be able to override which address the UI claims is the
 * treasury. So, like `src/lib/culler/config.ts`, this stays `server-only`
 * and is never read from `NEXT_PUBLIC_*`.
 *
 * Threshold is hard-pinned at exactly 3-of-3 (never configurable to
 * 2-of-3 or anything else) per the explicit Phase 6 requirement: no
 * single member, and no mere majority, may unilaterally control the
 * treasury. `getCullerTreasuryMultisigConfig()` fails closed (throws,
 * never silently proceeds with a different threshold) if the
 * environment ever specifies anything other than 3 members / 3-of-3.
 *
 * On-chain mechanism: this treasury multisig is a real SPL Token
 * program `Multisig` account (`@solana/spl-token`'s `createMultisig` /
 * `Multisig` account type — a currently-supported, zero-extra-
 * dependency, base Token Program feature present identically in both
 * the legacy SPL Token program and Token-2022, not a third-party
 * package). See `scripts/culler/create-devnet-multisig.ts` for how one is
 * actually created on Devnet, and docs/culler-treasury.md for why this
 * was chosen over installing a Squads SDK (Squads Protocol v4's
 * `@sqds/multisig` is a real, currently-maintained option -- see that
 * doc for the researched comparison -- but using it would mean trusting
 * an additional external program/SDK and a more complex proposal
 * workflow for a Devnet-prep phase that does not need it; nothing here
 * forecloses adopting it later).
 */

export const CULLER_TREASURY_THRESHOLD = 3;
export const CULLER_TREASURY_MEMBER_COUNT = 3;

export interface CullerTreasuryMultisigConfig {
  configured: true;
  /** The on-chain SPL Token `Multisig` account address. */
  multisigAddress: string;
  /** Exactly 3 member public keys (order matches on-chain signer order). */
  memberPublicKeys: [string, string, string];
  /** Always exactly 3. Kept as an explicit field (not just a constant)
   * so every consumer reads it from the config object and a future
   * attempt to construct a config with a different threshold is a type
   * error, not just a convention. */
  threshold: 3;
  network: "devnet" | "testnet" | "mainnet-beta";
}

export interface CullerTreasuryMultisigNotConfigured {
  configured: false;
  missing: string[];
}

export class CullerTreasuryMultisigConfigError extends Error {}

const REQUIRED_VARS = [
  "CULLER_TREASURY_MULTISIG_ADDRESS",
  "CULLER_TREASURY_MEMBER_1",
  "CULLER_TREASURY_MEMBER_2",
  "CULLER_TREASURY_MEMBER_3",
] as const;

/** A plausible base58 Solana public key: 32-44 base58 characters (no 0,
 * O, I, l). This is a shape check only, not a cryptographic validity
 * check (that requires `@solana/web3.js`'s `PublicKey` constructor,
 * used by callers that actually need a `PublicKey` object) -- it exists
 * so an obviously-malformed value (empty string, a private key array,
 * a URL pasted into the wrong variable) fails closed with a clear
 * message here rather than failing confusingly somewhere else later. */
const BASE58_PUBKEY_SHAPE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function assertLooksLikePublicKey(value: string, varName: string): void {
  if (!BASE58_PUBKEY_SHAPE.test(value)) {
    throw new CullerTreasuryMultisigConfigError(
      `${varName} does not look like a Solana public key (expected 32-44 base58 characters). ` +
        `This variable must hold a PUBLIC key only -- never a private/secret key.`
    );
  }
}

/**
 * Reads and validates the $CULLER treasury multisig configuration.
 * Returns `{ configured: false }` (never throws) if the required
 * variables are simply unset -- the normal state until a real Devnet
 * multisig has been created and wired in. Throws
 * `CullerTreasuryMultisigConfigError` (fails closed, never silently
 * "fixes" or ignores the problem) if the variables ARE set but are
 * malformed or violate the hard 3-of-3 / 3-member invariant -- for
 * example if the same public key were repeated, or if a 5th member
 * variable were set, or if any value does not look like a public key.
 */
export function getCullerTreasuryMultisigConfig(): CullerTreasuryMultisigConfig | CullerTreasuryMultisigNotConfigured {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    return { configured: false, missing };
  }

  const multisigAddress = process.env.CULLER_TREASURY_MULTISIG_ADDRESS!.trim();
  const member1 = process.env.CULLER_TREASURY_MEMBER_1!.trim();
  const member2 = process.env.CULLER_TREASURY_MEMBER_2!.trim();
  const member3 = process.env.CULLER_TREASURY_MEMBER_3!.trim();

  assertLooksLikePublicKey(multisigAddress, "CULLER_TREASURY_MULTISIG_ADDRESS");
  assertLooksLikePublicKey(member1, "CULLER_TREASURY_MEMBER_1");
  assertLooksLikePublicKey(member2, "CULLER_TREASURY_MEMBER_2");
  assertLooksLikePublicKey(member3, "CULLER_TREASURY_MEMBER_3");

  const members: [string, string, string] = [member1, member2, member3];
  const uniqueMembers = new Set(members);
  if (uniqueMembers.size !== CULLER_TREASURY_MEMBER_COUNT) {
    throw new CullerTreasuryMultisigConfigError(
      `$CULLER treasury multisig must have exactly ${CULLER_TREASURY_MEMBER_COUNT} DISTINCT members -- ` +
        `found a duplicate among CULLER_TREASURY_MEMBER_1/2/3. No member may appear twice (that would let one ` +
        `person's key count as two signatures toward the threshold).`
    );
  }

  // A 4th-or-later member variable (e.g. CULLER_TREASURY_MEMBER_4) being
  // set is a strong signal someone is trying to configure a different
  // M-of-N shape than this codebase supports. Fail closed rather than
  // silently ignoring it.
  if (process.env.CULLER_TREASURY_MEMBER_4?.trim()) {
    throw new CullerTreasuryMultisigConfigError(
      "CULLER_TREASURY_MEMBER_4 is set, but $CULLER's treasury multisig is fixed at exactly 3 members (3-of-3). " +
        "This codebase does not support a 4th member or any other M-of-N shape -- remove CULLER_TREASURY_MEMBER_4."
    );
  }

  const configuredThreshold = process.env.CULLER_TREASURY_THRESHOLD?.trim();
  if (configuredThreshold !== undefined && configuredThreshold !== String(CULLER_TREASURY_THRESHOLD)) {
    throw new CullerTreasuryMultisigConfigError(
      `CULLER_TREASURY_THRESHOLD is set to "${configuredThreshold}", but $CULLER's treasury multisig must be exactly ` +
        `3-of-3 -- it is never configurable to 2-of-3 or any other threshold. Remove CULLER_TREASURY_THRESHOLD ` +
        `(it is not read from the environment; it is hard-pinned to 3 in code) or set it to "3".`
    );
  }

  const network = (process.env.CULLER_NETWORK?.trim() as CullerTreasuryMultisigConfig["network"] | undefined) ?? "devnet";
  if (network !== "devnet" && network !== "testnet" && network !== "mainnet-beta") {
    throw new CullerTreasuryMultisigConfigError(`CULLER_NETWORK must be one of "devnet", "testnet", "mainnet-beta" (got "${network}").`);
  }

  return {
    configured: true,
    multisigAddress,
    memberPublicKeys: members,
    threshold: 3,
    network,
  };
}

/**
 * Asserts a (hypothetical, e.g. freshly-created on-chain) multisig
 * account actually has 3 members and a 3-of-3 threshold, independent of
 * environment configuration. Used by `scripts/culler/create-devnet-multisig.ts`
 * right after creating the account, and by tests, to catch a
 * `createMultisig(..., m)` call that was ever accidentally given the
 * wrong `m` or member list.
 */
export function assertIsThreeOfThree(memberCount: number, threshold: number): void {
  if (memberCount !== CULLER_TREASURY_MEMBER_COUNT || threshold !== CULLER_TREASURY_THRESHOLD) {
    throw new CullerTreasuryMultisigConfigError(
      `$CULLER treasury multisig must be exactly ${CULLER_TREASURY_MEMBER_COUNT}-of-${CULLER_TREASURY_MEMBER_COUNT} ` +
        `(3-of-3). Got ${threshold}-of-${memberCount}.`
    );
  }
}
