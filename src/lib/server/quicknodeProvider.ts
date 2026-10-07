import "server-only";
import { getSolanaRpcUrl } from "./config";

export interface AssetMetadata {
  assetId: string;
  mint: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  collection: string | null;
  collectionAddress: string | null;
  verifiedCollection: boolean | null;
  priceUsd: number | null;
  valueUsd: number | null;
  marketStatus: "AVAILABLE" | "NO_MARKET" | "UNKNOWN";
  liquidityStatus: "AVAILABLE" | "NO_MARKET" | "UNKNOWN" | "ERROR";
  metadataStatus: "AVAILABLE" | "UNAVAILABLE";
  assetType: "FUNGIBLE" | "NFT" | "COMPRESSED_NFT" | "OTHER" | "UNKNOWN";
  source: "quicknode-das";
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
    price_info?: { price_per_token?: number };
  };
  supply?: number;
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
  const assetType = assetInterface.includes("COMPRESSED") || assetInterface.includes("BUBBLEGUM")
    ? "COMPRESSED_NFT"
    : assetInterface.includes("NFT")
      ? "NFT"
      : assetInterface.includes("FUNGIBLE") || tokenInfo
        ? "FUNGIBLE"
        : "UNKNOWN";

  return {
    assetId: asset.id,
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
    response = await fetch(getSolanaRpcUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `culler-assets-${page}`,
        method: "getAssetsByOwner",
        params: { ownerAddress: owner, page, limit: 100, displayOptions: { showFungible: true } },
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
