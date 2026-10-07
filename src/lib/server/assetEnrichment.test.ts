import { describe, expect, it, vi } from "vitest";
import type { Asset } from "../types";
import { enrichSolanaAssets } from "./assetEnrichment";
import { getAssetsByOwner } from "./quicknodeProvider";

vi.mock("./quicknodeProvider", () => ({ getAssetsByOwner: vi.fn() }));

const rawAsset: Asset = {
  id: "token-account",
  name: "Unknown token",
  ticker: "UNKN",
  kind: "TOKEN",
  address: "token...",
  status: "REVIEW",
  age: "—",
  value: "UNKNOWN",
  valueKnown: false,
  reason: "Needs review",
  action: "REVIEW",
  tokenAccount: "token-account",
  mint: "mint-1",
  programId: "TokenProgram",
  rawBalance: "100",
  decimals: 2,
  valueClassification: "FUNGIBLE_UNKNOWN_VALUE",
  classification: "UNKNOWN_TOKEN",
};

describe("Solana asset enrichment", () => {
  it("keeps raw assets when QuickNode DAS is unavailable", async () => {
    vi.mocked(getAssetsByOwner).mockResolvedValue({
      assets: [],
      status: "UNAVAILABLE",
      reason: "Method not found",
    });

    const result = await enrichSolanaAssets("wallet", [rawAsset]);

    expect(result.status).toBe("UNAVAILABLE");
    expect(result.assets).toEqual([rawAsset]);
  });

  it("enriches by mint without adding a second asset", async () => {
    vi.mocked(getAssetsByOwner).mockResolvedValue({
      status: "AVAILABLE",
      assets: [
        {
          assetId: "mint-1",
          mint: "mint-1",
          name: "Example",
          symbol: "EX",
          imageUrl: null,
          collection: null,
          collectionAddress: null,
          verifiedCollection: null,
          priceUsd: 2,
          valueUsd: 2,
          marketStatus: "AVAILABLE",
          liquidityStatus: "UNKNOWN",
          metadataStatus: "AVAILABLE",
          assetType: "FUNGIBLE",
          source: "quicknode-das",
        },
      ],
    });

    const result = await enrichSolanaAssets("wallet", [rawAsset]);

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      name: "Example",
      ticker: "EX",
      valueClassification: "FUNGIBLE_VALUABLE",
    });
  });

  it("does not classify missing liquidity as no-liquidity", async () => {
    vi.mocked(getAssetsByOwner).mockResolvedValue({
      status: "AVAILABLE",
      assets: [
        {
          assetId: "mint-1",
          mint: "mint-1",
          name: null,
          symbol: null,
          imageUrl: null,
          collection: null,
          collectionAddress: null,
          verifiedCollection: null,
          priceUsd: 0.001,
          valueUsd: 0.001,
          marketStatus: "AVAILABLE",
          liquidityStatus: "UNKNOWN",
          metadataStatus: "UNAVAILABLE",
          assetType: "FUNGIBLE",
          source: "quicknode-das",
        },
      ],
    });

    const result = await enrichSolanaAssets("wallet", [rawAsset]);

    expect(result.assets[0].valueClassification).toBe("FUNGIBLE_LOW_VALUE");
  });
});
