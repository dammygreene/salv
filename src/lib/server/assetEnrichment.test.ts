import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "../types";
import { enrichSolanaAssets } from "./assetEnrichment";
import { getAssetsByMints, getAssetsByOwner } from "./quicknodeProvider";

vi.mock("./quicknodeProvider", () => ({ getAssetsByMints: vi.fn(), getAssetsByOwner: vi.fn() }));
vi.mock("./marketData", () => ({
  getBatchTokenPrices: vi.fn().mockResolvedValue(new Map()),
  getTokenMarketData: vi.fn().mockResolvedValue({
    priceUsd: null,
    priceStatus: "UNAVAILABLE",
    routeStatus: "UNKNOWN",
    liquidityUsd: null,
    volume24h: null,
    marketExists: null,
    confidence: "UNKNOWN",
    marketAvailable: null,
    status: "UNKNOWN",
    priceImpactBps: null,
    source: "test",
    checkedAt: "2026-01-01T00:00:00.000Z",
  }),
}));
vi.mock("./openSeaProvider", () => ({
  classifyNftMarket: vi.fn((market: { status: string }) => ({
    classification: market.status === "AVAILABLE" ? "NFT_LOW_VALUE" : "NFT_UNKNOWN_VALUE",
    valueUsd: null,
  })),
  getNftMarketDataBatch: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock("./magicEdenProvider", () => ({
  getMagicEdenMarketDataBatch: vi.fn().mockResolvedValue(new Map()),
}));

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
  beforeEach(() => {
    vi.mocked(getAssetsByMints).mockResolvedValue({ assets: [], status: "AVAILABLE" });
  });
  it("keeps Token-2022 identity while enriching a fungible mint", async () => {
    vi.mocked(getAssetsByOwner).mockResolvedValue({
      assets: [],
      status: "AVAILABLE",
    });
    vi.mocked(getAssetsByMints).mockResolvedValue({
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
          priceUsd: null,
          valueUsd: null,
          marketStatus: "UNKNOWN",
          liquidityStatus: "UNKNOWN",
          metadataStatus: "AVAILABLE",
          assetType: "FUNGIBLE",
          source: "quicknode-das",
        },
      ],
    });

    const result = await enrichSolanaAssets("wallet", [{ ...rawAsset, programId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1P" }]);

    expect(result.assets[0]).toMatchObject({
      programId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1P",
      valueClassification: "FUNGIBLE_UNKNOWN_VALUE",
      ticker: "EX",
    });
  });

  it("keeps raw assets when QuickNode DAS is unavailable", async () => {
    vi.mocked(getAssetsByOwner).mockResolvedValue({
      assets: [],
      status: "UNAVAILABLE",
      reason: "Method not found",
    });

    const result = await enrichSolanaAssets("wallet", [rawAsset]);

    expect(result.status).toBe("UNAVAILABLE");
    expect(result.assets[0]).toMatchObject(rawAsset);
    expect(result.assets[0].eligibility).toBe("CANDIDATE");
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

  it("keeps deferred NFT candidates unknown instead of dereferencing missing market data", async () => {
    const assets = Array.from({ length: 25 }, (_, index) => ({
      assetId: `compressed-${index}`,
      mint: `compressed-${index}`,
      name: `NFT ${index}`,
      symbol: null,
      imageUrl: null,
      collection: null,
      collectionAddress: null,
      verifiedCollection: null,
      priceUsd: null,
      valueUsd: null,
      marketStatus: "UNKNOWN" as const,
      liquidityStatus: "UNKNOWN" as const,
      metadataStatus: "AVAILABLE" as const,
      assetType: "COMPRESSED_NFT" as const,
      source: "quicknode-das" as const,
    }));
    vi.mocked(getAssetsByOwner).mockResolvedValue({ status: "AVAILABLE", assets });

    const result = await enrichSolanaAssets("wallet", []);

    expect(result.assets).toHaveLength(25);
    expect(result.assets[24].valueClassification).toBe("NFT_UNKNOWN_VALUE");
    expect(result.assets[24].eligibility).toBe("CANDIDATE");
  });
});
