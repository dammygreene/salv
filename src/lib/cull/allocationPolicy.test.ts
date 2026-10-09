import { describe, expect, it } from "vitest";
import { calculateScanAllocation, DEFAULT_ALLOCATION_POLICY } from "./allocationPolicy";
import type { Asset } from "../types";

function asset(id: string, classification: Asset["valueClassification"], confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" = "HIGH"): Asset {
  return {
    id, name: id, ticker: id, kind: classification?.startsWith("NFT_") ? "NFT" : classification === "EMPTY_ACCOUNT" ? "ACCOUNT" : "TOKEN",
    address: id, status: "REVIEW", age: "—", value: "UNKNOWN", valueKnown: false,
    reason: "test", action: "REVIEW", valueClassification: classification,
    eligibility: classification === "EMPTY_ACCOUNT" ? "ELIGIBLE" : "NOT_ELIGIBLE",
    eligibilityEvidence: {
      assetType: classification === "EMPTY_ACCOUNT" ? "EMPTY_ACCOUNT" : classification?.startsWith("NFT_") ? "NFT" : "FUNGIBLE",
      classification: classification ?? "FUNGIBLE_UNKNOWN_VALUE", eligibility: "ELIGIBLE", confidence,
      priceUsd: null, estimatedValueUsd: null, liquidityUsd: null, priceSource: null, liquiditySource: null,
      routeStatus: null, priceImpactBps: null, marketplace: null, floorUsd: null, bestListingUsd: null,
      bestOfferUsd: null, evidenceSources: [], checkedAt: null,
    },
  };
}

describe("scan allocation policy", () => {
  it("rewards only evidence-backed dead or low-value classifications", () => {
    const result = calculateScanAllocation([
      asset("empty", "EMPTY_ACCOUNT", "UNKNOWN"),
      asset("dead", "FUNGIBLE_NO_LIQUIDITY"),
      asset("low", "FUNGIBLE_LOW_VALUE"),
      asset("unknown", "FUNGIBLE_UNKNOWN_VALUE", "UNKNOWN"),
      asset("valuable", "FUNGIBLE_VALUABLE"),
    ]);
    expect(result.points).toBe(65);
    expect(result.contributions.map((item) => item.assetId)).toEqual(["dead", "empty", "low", "unknown"]);
  });

  it("enforces category, per-asset, and wallet caps deterministically", () => {
    const result = calculateScanAllocation([
      ...Array.from({ length: 30 }, (_, i) => asset(`empty-${i}`, "EMPTY_ACCOUNT", "UNKNOWN")),
      ...Array.from({ length: 30 }, (_, i) => asset(`nft-${i}`, "NFT_NO_MARKET")),
      ...Array.from({ length: 30 }, (_, i) => asset(`token-${i}`, "FUNGIBLE_NO_LIQUIDITY")),
    ]);
    expect(result.points).toBe(900);
    expect(result.contributions.filter((item) => item.category === "EMPTY_ACCOUNT").reduce((sum, item) => sum + item.points, 0)).toBe(300);
    expect(result.contributions.filter((item) => item.category === "NFT").reduce((sum, item) => sum + item.points, 0)).toBe(300);
    expect(result.contributions.filter((item) => item.category === "FUNGIBLE").reduce((sum, item) => sum + item.points, 0)).toBe(300);
    expect(result.points).toBeLessThanOrEqual(DEFAULT_ALLOCATION_POLICY.maxWalletPoints);
  });

  it("does not reward low-confidence market evidence", () => {
    expect(calculateScanAllocation([asset("low-confidence", "NFT_LOW_VALUE", "LOW")]).points).toBe(0);
  });

  it("gives unknown and review evidence a conservative baseline but keeps valuable evidence at zero", () => {
    const result = calculateScanAllocation([
      asset("unknown-fungible", "FUNGIBLE_UNKNOWN_VALUE"),
      asset("valuable-fungible", "FUNGIBLE_VALUABLE"),
      asset("unknown-nft", "NFT_UNKNOWN_VALUE"),
      asset("valuable-nft", "NFT_VALUABLE"),
      asset("review-nft", "NFT_REVIEW"),
    ]);
    expect(result.points).toBe(15);
    expect(result.contributions.map((item) => [item.assetId, item.points])).toEqual([
      ["review-nft", 5],
      ["unknown-fungible", 5],
      ["unknown-nft", 5],
    ]);
  });

  it("combines Solana and Robinhood assets without cross-chain collisions", () => {
    const solana = asset("shared-looking-id", "FUNGIBLE_UNKNOWN_VALUE");
    const robinhood = { ...asset("robinhood:shared-looking-id:fungible", "FUNGIBLE_UNKNOWN_VALUE"), network: "robinhood" as const };
    const result = calculateScanAllocation([solana, robinhood]);
    expect(result.points).toBe(10);
    expect(result.contributions.map((item) => item.assetId)).toEqual([
      "robinhood:shared-looking-id:fungible",
      "shared-looking-id",
    ]);
  });

  it("caps unknown assets by category", () => {
    const fungible = calculateScanAllocation(
      Array.from({ length: 500 }, (_, index) => asset(`fungible-${index}`, "FUNGIBLE_UNKNOWN_VALUE"))
    );
    const nfts = calculateScanAllocation(
      Array.from({ length: 500 }, (_, index) => asset(`nft-${index}`, "NFT_UNKNOWN_VALUE"))
    );
    expect(fungible.points).toBe(300);
    expect(nfts.points).toBe(300);
  });
});
