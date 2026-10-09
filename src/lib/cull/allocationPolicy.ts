import type { Asset, AssetClassification } from "../types";

export const DEFAULT_ALLOCATION_POLICY = {
  maxWalletPoints: 1_000,
  categoryCaps: { EMPTY_ACCOUNT: 300, FUNGIBLE: 300, NFT: 300 },
  perAssetCap: 100,
  emptyAccountPoints: 25,
  fungibleNoLiquidityPoints: 25,
  fungibleLowValuePoints: 10,
  fungibleUnknownPoints: 5,
  nftNoMarketPoints: 20,
  nftLowValuePoints: 10,
  nftUnknownPoints: 5,
  nftReviewPoints: 5,
  minimumConfidence: "MEDIUM" as const,
};

export type AllocationPolicy = typeof DEFAULT_ALLOCATION_POLICY;
export type AllocationCategory = keyof AllocationPolicy["categoryCaps"];

const CONFIDENCE_RANK = { UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3 } as const;

function categoryFor(asset: Asset): AllocationCategory | null {
  if (asset.valueClassification === "EMPTY_ACCOUNT") return "EMPTY_ACCOUNT";
  if (asset.valueClassification?.startsWith("FUNGIBLE_")) return "FUNGIBLE";
  if (asset.valueClassification?.startsWith("NFT_")) return "NFT";
  return null;
}

function pointsForClassification(classification: AssetClassification, policy: AllocationPolicy): number {
  switch (classification) {
    case "EMPTY_ACCOUNT": return policy.emptyAccountPoints;
    case "FUNGIBLE_NO_LIQUIDITY": return policy.fungibleNoLiquidityPoints;
    case "FUNGIBLE_LOW_VALUE": return policy.fungibleLowValuePoints;
    case "FUNGIBLE_UNKNOWN_VALUE": return policy.fungibleUnknownPoints;
    case "NFT_NO_MARKET": return policy.nftNoMarketPoints;
    case "NFT_LOW_VALUE": return policy.nftLowValuePoints;
    case "NFT_UNKNOWN_VALUE": return policy.nftUnknownPoints;
    case "NFT_REVIEW": return policy.nftReviewPoints;
    default: return 0;
  }
}

function confidenceFor(asset: Asset): keyof typeof CONFIDENCE_RANK {
  return asset.eligibilityEvidence?.confidence ?? "UNKNOWN";
}

export interface AssetAllocationContribution {
  assetId: string;
  classification: AssetClassification;
  category: AllocationCategory;
  confidence: keyof typeof CONFIDENCE_RANK;
  points: number;
}

export interface AllocationResult {
  points: number;
  contributions: AssetAllocationContribution[];
}

export function calculateScanAllocation(assets: Asset[], policy: AllocationPolicy = DEFAULT_ALLOCATION_POLICY): AllocationResult {
  const categoryTotals: Record<AllocationCategory, number> = { EMPTY_ACCOUNT: 0, FUNGIBLE: 0, NFT: 0 };
  const contributions: AssetAllocationContribution[] = [];
  const ordered = [...assets].sort((a, b) => a.id.localeCompare(b.id));

  for (const asset of ordered) {
    const classification = asset.valueClassification;
    const category = categoryFor(asset);
    const confidence = confidenceFor(asset);
    const baselineClassification =
      classification === "FUNGIBLE_UNKNOWN_VALUE" ||
      classification === "NFT_UNKNOWN_VALUE" ||
      classification === "NFT_REVIEW";
    if (!classification || !category || (
      classification !== "EMPTY_ACCOUNT" &&
      !baselineClassification &&
      CONFIDENCE_RANK[confidence] < CONFIDENCE_RANK[policy.minimumConfidence]
    )) continue;
    const points = Math.min(policy.perAssetCap, pointsForClassification(classification, policy));
    const accepted = Math.min(points, policy.categoryCaps[category] - categoryTotals[category], policy.maxWalletPoints - contributions.reduce((sum, item) => sum + item.points, 0));
    if (accepted <= 0) continue;
    categoryTotals[category] += accepted;
    contributions.push({ assetId: asset.id, classification, category, confidence, points: accepted });
    if (contributions.reduce((sum, item) => sum + item.points, 0) >= policy.maxWalletPoints) break;
  }
  return { points: contributions.reduce((sum, item) => sum + item.points, 0), contributions };
}
