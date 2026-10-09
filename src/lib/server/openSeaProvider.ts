import "server-only";
import type { NftMarketData } from "../types";
import type { AssetMetadata } from "./quicknodeProvider";
import { countEnrichmentRequest } from "./enrichmentMetrics";

const OPEN_SEA_API = "https://api.opensea.io/api/v2";
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type OpenSeaNft = {
  collection?: string;
  collection_slug?: string;
  name?: string;
  image_url?: string;
  listings?: Record<string, unknown>;
  offers?: Record<string, unknown>;
};

type OpenSeaStats = {
  total?: { floor_price?: number; volume?: number };
  intervals?: Array<{ interval?: string; volume?: number }>;
};

export type OpenSeaIdentityResolution =
  | { status: "RESOLVED"; contract: string; identifier: string; collectionSlug: string | null }
  | { status: "UNSUPPORTED_ASSET"; reason: string }
  | { status: "UNRESOLVED"; reason: string };

export function resolveOpenSeaIdentity(asset: Pick<AssetMetadata, "assetId" | "mint" | "assetType" | "collectionAddress" | "compression">): OpenSeaIdentityResolution {
  if (asset.assetType === "COMPRESSED_NFT" || asset.compression?.compressed) {
    return { status: "UNSUPPORTED_ASSET", reason: "OpenSea item lookup does not expose a DAS compression identity." };
  }
  if (asset.assetType !== "NFT") {
    return { status: "UNSUPPORTED_ASSET", reason: `OpenSea NFT lookup does not support DAS asset type ${asset.assetType}.` };
  }
  if (!SOLANA_ADDRESS.test(asset.mint) || !asset.collectionAddress || !SOLANA_ADDRESS.test(asset.collectionAddress)) {
    return { status: "UNRESOLVED", reason: "DAS did not provide both a Solana mint and collection address." };
  }
  return {
    status: "RESOLVED",
    contract: asset.collectionAddress,
    identifier: asset.mint,
    collectionSlug: null,
  };
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function unknownResult(reason: "unconfigured" | "unresolved" | "unavailable"): NftMarketData {
  return {
    floorPrice: null,
    floorPriceUsd: null,
    bestListing: null,
    bestOffer: null,
    recentSale: null,
    volume24h: null,
    marketExists: null,
    status: reason === "unavailable" ? "PROVIDER_UNAVAILABLE" : "UNKNOWN",
    source: "opensea",
    collectionSlug: null,
    checkedAt: new Date().toISOString(),
    confidence: "UNKNOWN",
  };
}

async function getJson<T>(url: string, apiKey: string): Promise<T | null> {
  countEnrichmentRequest("OPENSEA");
  const response = await fetch(url, {
    headers: { accept: "application/json", "x-api-key": apiKey },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

function extractPrice(record: Record<string, unknown> | undefined): number | null {
  if (!record) return null;
  return numberOrNull(record.price ?? record.value ?? record.amount);
}

export async function getNftMarketData(
  asset: Pick<AssetMetadata, "assetId" | "mint" | "assetType" | "collectionAddress" | "compression">,
  apiKey: string | null,
  collectionStatsCache: Map<string, Promise<OpenSeaStats | null>> = new Map()
): Promise<NftMarketData> {
  if (!apiKey) return unknownResult("unconfigured");
  const identity = resolveOpenSeaIdentity(asset);
  if (identity.status !== "RESOLVED") return unknownResult("unresolved");

  try {
    const nft = await getJson<OpenSeaNft>(
      `${OPEN_SEA_API}/chain/solana/contract/${encodeURIComponent(identity.contract)}/nfts/${encodeURIComponent(identity.identifier)}`,
      apiKey
    );
    if (!nft) return unknownResult("unresolved");
    const collectionSlug = nft.collection_slug ?? nft.collection ?? null;
    if (!collectionSlug) return unknownResult("unresolved");

    const statsRequest = collectionStatsCache.get(collectionSlug) ?? getJson<OpenSeaStats>(
        `${OPEN_SEA_API}/collections/${encodeURIComponent(collectionSlug)}/stats`,
        apiKey
      );
    collectionStatsCache.set(collectionSlug, statsRequest);
    const stats = await statsRequest;
    if (!stats) return unknownResult("unavailable");
    const floorPrice = numberOrNull(stats.total?.floor_price);
    const volume24h = numberOrNull(stats.intervals?.find((interval) => interval.interval === "one_day")?.volume);
    const bestListing = extractPrice(nft.listings);
    const bestOffer = extractPrice(nft.offers);
    const hasEvidence = bestListing !== null || bestOffer !== null || floorPrice !== null || volume24h !== null;

    return {
      floorPrice,
      floorPriceUsd: null,
      bestListing,
      bestOffer,
      recentSale: null,
      volume24h,
      marketExists: hasEvidence,
      status: hasEvidence ? "AVAILABLE" : "NO_MARKET",
      source: "opensea",
      collectionSlug,
      checkedAt: new Date().toISOString(),
      confidence: bestOffer !== null || bestListing !== null ? "HIGH" : floorPrice !== null ? "MEDIUM" : "LOW",
    };
  } catch {
    return unknownResult("unavailable");
  }

}

export async function getNftMarketDataBatch(
  assets: Array<Pick<AssetMetadata, "assetId" | "mint" | "assetType" | "collectionAddress" | "compression">>,
  apiKey: string | null
): Promise<Map<string, NftMarketData>> {
  const results = new Map<string, NftMarketData>();
  const collectionStatsCache = new Map<string, Promise<OpenSeaStats | null>>();
  const unique = [...new Map(assets.map((asset) => [asset.assetId, asset])).values()];
  if (!apiKey) {
    for (const asset of unique) results.set(asset.assetId, unknownResult("unconfigured"));
    return results;
  }
  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, unique.length) }, async () => {
    while (cursor < unique.length) {
      const index = cursor++;
      const asset = unique[index];
      results.set(
        asset.assetId,
        await getNftMarketData(asset, apiKey, collectionStatsCache)
      );
    }
  });
  await Promise.all(workers);
  return results;
}

export function classifyNftMarket(
  market: NftMarketData,
  minimumValueUsd: number
): { classification: "NFT_VALUABLE" | "NFT_LOW_VALUE" | "NFT_NO_MARKET" | "NFT_UNKNOWN_VALUE" | "NFT_REVIEW"; valueUsd: number | null } {
  if (market.status === "PROVIDER_UNAVAILABLE" || market.status === "UNKNOWN") {
    return { classification: "NFT_UNKNOWN_VALUE", valueUsd: null };
  }
  if (market.status === "NO_MARKET") return { classification: "NFT_NO_MARKET", valueUsd: null };
  const valueUsd = market.bestOffer ?? market.bestListing ?? market.floorPriceUsd;
  if (valueUsd === null) return { classification: "NFT_REVIEW", valueUsd: null };
  return {
    classification: valueUsd >= minimumValueUsd ? "NFT_VALUABLE" : "NFT_LOW_VALUE",
    valueUsd,
  };
}
