import type { AssetClassification, AssetEligibility } from "./types";

/**
 * Single source of truth for market/value eligibility. Unknown and review
 * classifications are allocation candidates even when their market evidence
 * is incomplete; this does not make them safe for an on-chain close action.
 */
export function evaluateAssetEligibility(classification: AssetClassification | undefined): AssetEligibility {
  switch (classification) {
    case "EMPTY_ACCOUNT":
      return "ELIGIBLE";
    case "FUNGIBLE_NO_LIQUIDITY":
      return "CANDIDATE";
    case "FUNGIBLE_LOW_VALUE":
    case "NFT_NO_MARKET":
    case "NFT_LOW_VALUE":
    case "FUNGIBLE_UNKNOWN_VALUE":
    case "NFT_UNKNOWN_VALUE":
    case "NFT_REVIEW":
      return "CANDIDATE";
    case "FUNGIBLE_VALUABLE":
    case "FUNGIBLE_NO_MARKET":
    case "FUNGIBLE_NEGLIGIBLE_VALUE":
    case "NFT_VALUABLE":
    default:
      return "NOT_ELIGIBLE";
  }
}
