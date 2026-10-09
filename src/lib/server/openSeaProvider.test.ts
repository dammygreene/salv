import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyNftMarket, getNftMarketData, resolveOpenSeaIdentity } from "./openSeaProvider";

describe("OpenSea NFT market intelligence", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps unresolved NFTs unknown and never guesses a collection slug", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await getNftMarketData({
      assetId: "mint",
      mint: "mint",
      assetType: "NFT",
      collectionAddress: "not-a-solana-address",
      compression: null,
    }, "key");
    expect(result.status).toBe("UNKNOWN");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps NFTs visible as unknown when the provider is not configured", async () => {
    const result = await getNftMarketData({
      assetId: "mint",
      mint: "mint",
      assetType: "NFT",
      collectionAddress: null,
      compression: null,
    }, null);
    expect(result.status).toBe("UNKNOWN");
    expect(result.confidence).toBe("UNKNOWN");
  });

  it("resolves collection stats with read-only GET requests", async () => {
    const mint = "7VHUFJHWu2CuExkJcJrzhQPJ2oygupTWkL2A2For4BmE";
    const contract = "7VHUFJHWu2CuExkJcJrzhQPJ2oygupTWkL2A2For4BmE";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ collection_slug: "example" }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ total: { floor_price: 0.04 } }), { status: 200 }))
    );
    const result = await getNftMarketData({
      assetId: mint,
      mint,
      assetType: "NFT",
      collectionAddress: contract,
      compression: null,
    }, "key");
    expect(result.collectionSlug).toBe("example");
    expect(result.floorPrice).toBe(0.04);
    expect(result.status).toBe("AVAILABLE");
    expect(result.confidence).toBe("MEDIUM");
  });

  it("separates compressed, unresolved, and supported NFT identities", () => {
    const mint = "7VHUFJHWu2CuExkJcJrzhQPJ2oygupTWkL2A2For4BmE";
    expect(resolveOpenSeaIdentity({
      assetId: mint,
      mint,
      assetType: "COMPRESSED_NFT",
      collectionAddress: mint,
      compression: { compressed: true, tree: null, leafId: null },
    }).status).toBe("UNSUPPORTED_ASSET");
    expect(resolveOpenSeaIdentity({
      assetId: mint,
      mint,
      assetType: "NFT",
      collectionAddress: null,
      compression: null,
    }).status).toBe("UNRESOLVED");
    expect(resolveOpenSeaIdentity({
      assetId: mint,
      mint,
      assetType: "NFT",
      collectionAddress: mint,
      compression: null,
    }).status).toBe("RESOLVED");
  });

  it("classifies a missing market as no-market and a provider failure as unknown", () => {
    expect(classifyNftMarket({
      floorPrice: null, floorPriceUsd: null, bestListing: null, bestOffer: null, recentSale: null,
      volume24h: null, marketExists: false, status: "NO_MARKET", source: "opensea",
      collectionSlug: "empty", checkedAt: "now", confidence: "LOW",
    }, 0.01).classification).toBe("NFT_NO_MARKET");
    expect(classifyNftMarket({
      floorPrice: null, floorPriceUsd: null, bestListing: null, bestOffer: null, recentSale: null,
      volume24h: null, marketExists: null, status: "PROVIDER_UNAVAILABLE", source: "opensea",
      collectionSlug: null, checkedAt: "now", confidence: "UNKNOWN",
    }, 0.01).classification).toBe("NFT_UNKNOWN_VALUE");
  });
});
