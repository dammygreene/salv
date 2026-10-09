import { describe, expect, it, vi } from "vitest";
import type { Db } from "../db/types";
import { findFreshAssetKnowledge, upsertAssetKnowledge, upsertAssetKnowledgeBatch } from "./assetKnowledgeRepo";

function fakeDb(rows: Array<Record<string, unknown>>): Db {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
    transaction: vi.fn(),
  };
}

describe("asset knowledge repository", () => {
  it("returns fresh records by asset identity and mint", async () => {
    const db = fakeDb([{
      assetType: "FUNGIBLE",
      assetId: "das-id",
      mintAddress: "mint-a",
      evidence: {},
      coverageStatus: "CHECKED",
      nextRefreshAt: "2099-01-01T00:00:00.000Z",
    }]);
    const result = await findFreshAssetKnowledge(db, [{
      assetType: "FUNGIBLE",
      assetId: "das-id",
      mint: "mint-a",
    }]);
    expect(result.get("FUNGIBLE:mint-a")?.assetId).toBe("das-id");
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("coverage_status"), [["das-id", "mint-a"]]);
  });

  it("upserts evidence without wallet-specific data", async () => {
    const db = fakeDb([]);
    await upsertAssetKnowledge(db, {
      assetType: "COMPRESSED_NFT",
      assetId: "asset-a",
      mintAddress: "asset-a",
      collectionAddress: null,
      name: "NFT",
      symbol: null,
      decimals: null,
      tokenProgram: null,
      compressed: true,
      classification: "NFT_UNKNOWN_VALUE",
      eligibility: "NOT_ELIGIBLE",
      confidence: "UNKNOWN",
      evidence: { nftMarketData: { source: "magic-eden" } },
      metadataStatus: "AVAILABLE",
      providerStatus: "SUCCESS",
      lastCheckedAt: new Date().toISOString(),
      nextRefreshAt: null,
      coverageStatus: "CHECKED",
      nextRetryAt: null,
    }, 1_800_000);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT (network, asset_type, asset_id)"), expect.arrayContaining([
      "COMPRESSED_NFT",
      "asset-a",
      expect.stringContaining("magic-eden"),
    ]));
  });

  it("persists large batches with bounded database operations", async () => {
    const db = fakeDb(Array.from({ length: 405 }, () => ({ created: true })));
    const input = {
      assetType: "COMPRESSED_NFT" as const,
      assetId: "asset-a",
      mintAddress: "asset-a",
      collectionAddress: null,
      name: "NFT",
      symbol: null,
      decimals: null,
      tokenProgram: null,
      compressed: true,
      classification: null,
      eligibility: "NOT_ELIGIBLE",
      confidence: "UNKNOWN",
      evidence: {},
      metadataStatus: "AVAILABLE",
      providerStatus: "SUCCESS",
      lastCheckedAt: null,
      nextRefreshAt: null,
      coverageStatus: "DEFERRED" as const,
      nextRetryAt: null,
    };
    const result = await upsertAssetKnowledgeBatch(db, Array.from({ length: 405 }, (_, index) => ({
      input: { ...input, assetId: `asset-${index}` },
      ttlMs: null,
    })));

    expect(result.operations).toBe(3);
    expect(db.query).toHaveBeenCalledTimes(3);
  });
});
