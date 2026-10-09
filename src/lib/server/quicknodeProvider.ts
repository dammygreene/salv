import "server-only";
import { getSolanaRpcUrl } from "./config";
import type { NftMarketData, TokenMarketData } from "../types";
import { countEnrichmentRequest } from "./enrichmentMetrics";

export interface AssetMetadata {
  assetId: string;
  dasInterface?: string | null;
  ownership?: { owner: string | null; frozen: boolean | null } | null;
  compression?: { compressed: boolean; tree: string | null; leafId: number | null } | null;
  mint: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  collection: string | null;
  collectionAddress: string | null;
  verifiedCollection: boolean | null;
  priceUsd: number | null;
  valueUsd: number | null;
  marketStatus: "AVAILABLE" | "NO_MARKET" | "UNKNOWN" | "ERROR";
  liquidityStatus: "AVAILABLE" | "NO_MARKET" | "UNKNOWN" | "ERROR";
  metadataStatus: "AVAILABLE" | "UNAVAILABLE";
  assetType: "FUNGIBLE" | "NFT" | "COMPRESSED_NFT" | "OTHER" | "UNKNOWN";
  source: "quicknode-das";
  marketData?: TokenMarketData;
  nftMarketData?: NftMarketData;
}

export type QuickNodeAssetsResult = {
  assets: AssetMetadata[];
  status: "AVAILABLE" | "UNAVAILABLE";
  reason?: string;
};

type QuickNodeAsset = {
  id?: string;
  interface?: string;
  content?: {
    metadata?: { name?: string; symbol?: string };
    links?: { image?: string };
  };
  grouping?: Array<{ group_key?: string; group_value?: string; verified?: boolean }>;
  token_info?: {
    symbol?: string;
    decimals?: number;
    balance?: number | string;
    supply?: number | string;
    token_program?: string;
    price_info?: { price_per_token?: number };
  };
  supply?: number;
  ownership?: { owner?: string; frozen?: boolean };
  compression?: { compressed?: boolean; tree?: string; leaf_id?: number };
};

function numberOrNull(value: number | string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapAsset(asset: QuickNodeAsset): AssetMetadata | null {
  if (!asset.id) return null;
  const tokenInfo = asset.token_info;
  const priceUsd = numberOrNull(tokenInfo?.price_info?.price_per_token);
  const rawBalance = numberOrNull(tokenInfo?.balance);
  const balance = rawBalance !== null && tokenInfo?.decimals !== undefined
    ? rawBalance / 10 ** tokenInfo.decimals
    : rawBalance;
  const valueUsd = priceUsd !== null && balance !== null ? priceUsd * balance : null;
  const collection = asset.grouping?.find((group) => group.group_key === "collection");
  const assetInterface = asset.interface?.toUpperCase() ?? "";
  const isCompressed = asset.compression?.compressed === true || assetInterface.includes("COMPRESSED") || assetInterface.includes("BUBBLEGUM");
  const assetType = isCompressed
    ? "COMPRESSED_NFT"
    : assetInterface.includes("NFT")
      ? "NFT"
      : assetInterface.includes("FUNGIBLE") || tokenInfo
        ? "FUNGIBLE"
        : "UNKNOWN";

  return {
    assetId: asset.id,
    dasInterface: asset.interface ?? null,
    ownership: asset.ownership
      ? { owner: asset.ownership.owner ?? null, frozen: asset.ownership.frozen ?? null }
      : null,
    compression: asset.compression
      ? {
          compressed: asset.compression.compressed === true,
          tree: asset.compression.tree ?? null,
          leafId: asset.compression.leaf_id ?? null,
        }
      : null,
    mint: asset.id,
    name: asset.content?.metadata?.name ?? null,
    symbol: tokenInfo?.symbol ?? asset.content?.metadata?.symbol ?? null,
    imageUrl: asset.content?.links?.image ?? null,
    collection: collection?.group_value ?? null,
    collectionAddress: collection?.group_value ?? null,
    verifiedCollection: collection?.verified ?? null,
    priceUsd,
    valueUsd,
    marketStatus: priceUsd === null ? "UNKNOWN" : "AVAILABLE",
    liquidityStatus: "UNKNOWN",
    metadataStatus: asset.content ? "AVAILABLE" : "UNAVAILABLE",
    assetType,
    source: "quicknode-das",
  };
}

async function requestAssets(owner: string, page: number): Promise<{ items: QuickNodeAsset[]; total: number | null }> {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    countEnrichmentRequest("QUICKNODE");
    response = await fetch(getSolanaRpcUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAssetsByOwner",
        params: {
          ownerAddress: owner,
          page,
          limit: 100,
          options: {
            showFungible: true,
            showCollectionMetadata: true,
          },
        },
      }),
      cache: "no-store",
    });
    if (response.status !== 429 || attempt === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!response) throw new Error("QuickNode asset API did not return a response.");
  if (!response.ok) throw new Error(`QuickNode asset API returned HTTP ${response.status}.`);
  const body = (await response.json()) as {
    result?: { items?: QuickNodeAsset[]; total?: number };
    error?: { message?: string };
  };
  if (body.error) throw new Error(body.error.message ?? "QuickNode asset API returned an error.");
  if (!body.result) throw new Error("QuickNode asset API returned an invalid response.");
  return { items: body.result.items ?? [], total: body.result.total ?? null };
}

async function requestAssetsByIds(mints: string[]): Promise<QuickNodeAsset[]> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    countEnrichmentRequest("QUICKNODE");
    const response = await fetch(getSolanaRpcUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAssets",
        params: {
          ids: mints,
          options: { showFungible: true, showCollectionMetadata: true },
        },
      }),
      cache: "no-store",
    });
    if ((response.status === 429 || response.status >= 500) && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }
    if (!response.ok) throw new Error(`QuickNode batch asset API returned HTTP ${response.status}.`);
    const body = (await response.json()) as { result?: QuickNodeAsset[]; error?: { message?: string } };
    if (body.error) throw new Error(body.error.message ?? "QuickNode batch asset API returned an error.");
    return body.result ?? [];
  }
  throw new Error("QuickNode batch asset API retry limit reached.");
}

export async function getAssetsByOwner(owner: string): Promise<QuickNodeAssetsResult> {
  try {
    const all: QuickNodeAsset[] = [];
    let page = 1;
    let lastPageCount = 0;
    do {
      const result = await requestAssets(owner, page);
      all.push(...result.items);
      lastPageCount = result.items.length;
      page += 1;
    } while (page <= 100 && lastPageCount === 100);

    const assets = Array.from(
      new Map(
        all
          .map(mapAsset)
          .filter((asset): asset is AssetMetadata => asset !== null)
          .map((asset) => [asset.mint, asset])
      ).values()
    );
    return { assets, status: "AVAILABLE" };
  } catch (error) {
    return {
      assets: [],
      status: "UNAVAILABLE",
      reason: error instanceof Error ? error.message : "QuickNode asset API unavailable.",
    };
  }
}

export async function getAssetsByMints(mints: string[]): Promise<QuickNodeAssetsResult> {
  const uniqueMints = [...new Set(mints)];
  const assets: AssetMetadata[] = [];
  const batchSize = 50;
  for (let index = 0; index < uniqueMints.length; index += batchSize) {
    try {
      const batch = await requestAssetsByIds(uniqueMints.slice(index, index + batchSize));
      assets.push(...batch.map(mapAsset).filter((asset): asset is AssetMetadata => asset !== null));
    } catch {
      continue;
    }
  }
  return {
    assets: Array.from(new Map(assets.map((asset) => [asset.mint, asset])).values()),
    status: "AVAILABLE",
  };
}
