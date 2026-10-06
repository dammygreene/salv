/**
 * CULLER REGISTRY — the single, explicit source of truth for what
 * CULLER supports today. Every classification an asset can receive maps
 * to exactly one disposition and (optionally) one real on-chain action.
 *
 * This module is intentionally plain data with no server-only APIs, so
 * both the client-side scanner (for labeling/preview) and the
 * server-side verification/points pipeline (the only place that is ever
 * trusted to award anything) can import the same definitions. The
 * *enabled* flag is what actually matters for trust: the backend checks
 * `entry.enabled` before it will ever create a points-bearing record for
 * an action, regardless of what a client requests or claims.
 *
 * Nothing here invents a heuristic that treats "no known price" as
 * "safe to burn". A token only ever becomes KNOWN_SPAM_TOKEN or
 * KNOWN_SPAM_NFT once a real, maintained spam signal exists — and none
 * does yet (see validation/eligibility.ts), so BURN_VERIFIED_TOKEN and
 * BURN_VERIFIED_NFT stay `enabled: false` and unreachable from the UI.
 */

export type AssetClassification =
  | "EMPTY_TOKEN_ACCOUNT"
  | "KNOWN_SPAM_TOKEN"
  | "KNOWN_SPAM_NFT"
  | "UNKNOWN_TOKEN"
  | "ACTIVE_TOKEN"
  | "POTENTIALLY_REDEEMABLE_NFT";

export type CullActionType = "CLOSE_EMPTY_TOKEN_ACCOUNT" | "BURN_VERIFIED_TOKEN" | "BURN_VERIFIED_NFT";

/** Registry-level disposition. The UI's existing AssetStatus badge
 * ("CULLABLE" | "WATCH" | "REVIEW" | "KEEP") collapses RECOVERABLE and
 * CULLABLE into the same single actionable badge — both mean "this can
 * go in the bin" — see solana/scanner/scan.ts's mapping. */
export type CullDisposition = "RECOVERABLE" | "CULLABLE" | "REVIEW" | "KEEP" | "WATCH";

export interface CullRegistryEntry {
  classification: AssetClassification;
  action: CullActionType | null;
  disposition: CullDisposition;
  /** Whether the backend will ever actually execute/verify/award points
   * for this action today. False means: architecture exists, nothing can
   * reach it yet. */
  enabled: boolean;
  expectedRecovery: "RENT_LAMPORTS" | "NONE";
  /** Base points if a verified action of this type is ever recorded.
   * Null when there is no action (REVIEW/KEEP/WATCH dispositions). */
  basePoints: number | null;
  eligibilityRule: string;
  verificationRule: string;
}

export const CULLER_REGISTRY: Record<AssetClassification, CullRegistryEntry> = {
  EMPTY_TOKEN_ACCOUNT: {
    classification: "EMPTY_TOKEN_ACCOUNT",
    action: "CLOSE_EMPTY_TOKEN_ACCOUNT",
    disposition: "RECOVERABLE",
    enabled: true,
    expectedRecovery: "RENT_LAMPORTS",
    basePoints: 100,
    eligibilityRule: "validation/eligibility.ts#evaluateCloseAccountEligibility — zero balance, owner matches, not frozen",
    verificationRule:
      "server/verifyCullTransaction.ts — real closeAccount instruction present, owner matches, post-balance is zero",
  },
  KNOWN_SPAM_TOKEN: {
    classification: "KNOWN_SPAM_TOKEN",
    action: "BURN_VERIFIED_TOKEN",
    disposition: "CULLABLE",
    enabled: false,
    expectedRecovery: "NONE",
    basePoints: 150,
    eligibilityRule: "NOT IMPLEMENTED — requires a maintained spam-token registry; nothing classifies as this today",
    verificationRule: "burn instruction present, mint matches a known spam entry, owner matches (not built yet)",
  },
  KNOWN_SPAM_NFT: {
    classification: "KNOWN_SPAM_NFT",
    action: "BURN_VERIFIED_NFT",
    disposition: "CULLABLE",
    enabled: false,
    expectedRecovery: "NONE",
    basePoints: 250,
    eligibilityRule:
      "NOT IMPLEMENTED — requires asset-standard-aware spam/collection signal (compressed vs non-compressed, collection/creator/update authority); nothing classifies as this today",
    verificationRule: "burn instruction present, mint matches a known spam collection, owner matches (not built yet)",
  },
  UNKNOWN_TOKEN: {
    classification: "UNKNOWN_TOKEN",
    action: null,
    disposition: "REVIEW",
    enabled: false,
    expectedRecovery: "NONE",
    basePoints: null,
    eligibilityRule: "Any non-empty fungible balance not in the trusted token list. A $0/unknown price alone never promotes this to burnable.",
    verificationRule: "N/A — no action is ever taken automatically",
  },
  ACTIVE_TOKEN: {
    classification: "ACTIVE_TOKEN",
    action: null,
    disposition: "KEEP",
    enabled: false,
    expectedRecovery: "NONE",
    basePoints: null,
    eligibilityRule: "Non-empty fungible balance verified against the trusted token list (Jupiter strict list).",
    verificationRule: "N/A — no action is ever taken",
  },
  POTENTIALLY_REDEEMABLE_NFT: {
    classification: "POTENTIALLY_REDEEMABLE_NFT",
    action: null,
    disposition: "WATCH",
    enabled: false,
    expectedRecovery: "NONE",
    basePoints: null,
    eligibilityRule: "decimals = 0 and amount = 1 (NFT-shaped). No burn signal exists, so every NFT is watch-only for now.",
    verificationRule: "N/A — no action is ever taken",
  },
};

/** Maps a registry disposition onto the UI's existing status badge
 * vocabulary without introducing a new badge/redesigning anything. */
export function dispositionToAssetStatus(disposition: CullDisposition): "CULLABLE" | "WATCH" | "REVIEW" | "KEEP" {
  if (disposition === "RECOVERABLE" || disposition === "CULLABLE") return "CULLABLE";
  return disposition;
}

export function getRegistryEntry(classification: AssetClassification): CullRegistryEntry {
  return CULLER_REGISTRY[classification];
}

/** The ONLY authoritative check for whether an action type may ever
 * produce a points-bearing VERIFIED record. Server-side callers must
 * consult this — never a client-submitted flag. */
export function isActionEnabled(action: CullActionType): boolean {
  return Object.values(CULLER_REGISTRY).some((entry) => entry.action === action && entry.enabled);
}
