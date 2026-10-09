import "server-only";
import type { NftMarketData } from "../types";
import type { AssetMetadata } from "./quicknodeProvider";
import { countEnrichmentRequest } from "./enrichmentMetrics";

const MAGIC_EDEN_API = "https://api-mainnet.magiceden.dev/v2";
const KEYLESS_REQUEST_INTERVAL_MS = 550;
let nextKeylessRequestAt = 0;
let keylessRequestQueue = Promise.resolve();

type MagicEdenResponse = Record<string, unknown> | Array<Record<string, unknown>>;
type ProviderMode = "KEYLESS" | "AUTHENTICATED";

function numberOrNull(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function nestedNumber(value: unknown, keys: string[]): number | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const parsed = numberOrNull(record[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function nativePrice(value: unknown): number | null {
  const direct = nestedNumber(value, ["price", "priceSol", "price_sol", "amount"]);
  if (direct !== null) return direct > 1_000_000 ? direct / 1_000_000_000 : direct;
  return null;
}

function unknownResult(status: "UNKNOWN" | "PROVIDER_UNAVAILABLE", providerMode: ProviderMode): NftMarketData {
  return {
    floorPrice: null,
    floorPriceUsd: null,
    bestListing: null,
    bestOffer: null,
    recentSale: null,
    volume24h: null,
    marketExists: null,
    status,
    source: "magic-eden",
    collectionSlug: null,
    checkedAt: new Date().toISOString(),
    confidence: "UNKNOWN",
    marketplaceSources: ["magic-eden"],
    activityCount: null,
    floorPriceNative: null,
    bestListingNative: null,
    bestOfferNative: null,
    recentSaleNative: null,
    nativeCurrency: "SOL",
    providerMode,
  };
}

function paceKeylessRequest(): Promise<void> {
  const request = keylessRequestQueue.then(async () => {
    const wait = Math.max(0, nextKeylessRequestAt - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    nextKeylessRequestAt = Date.now() + KEYLESS_REQUEST_INTERVAL_MS;
  });
  keylessRequestQueue = request.catch(() => undefined);
  return request;
}

async function requestJson(
  url: string,
  apiKey: string | null
): Promise<{ data: MagicEdenResponse | null; status: number }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!apiKey) await paceKeylessRequest();
    const headers: Record<string, string> = { accept: "application/json" };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
      headers["X-NFT-API-Key"] = apiKey;
    }
    countEnrichmentRequest("MAGIC_EDEN");
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if ((response.status === 429 || response.status >= 500) && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, response.status === 429 ? 1_000 : 500));
      continue;
    }
    if (!response.ok) return { data: null, status: response.status };
    return { data: (await response.json()) as MagicEdenResponse, status: response.status };
  }
  return { data: null, status: 503 };
}

function firstRecord(data: MagicEdenResponse | null): Record<string, unknown> | null {
  if (!data) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

function records(data: MagicEdenResponse | null): Array<Record<string, unknown>> {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results as Array<Record<string, unknown>>;
  if (Array.isArray(data.items)) return data.items as Array<Record<string, unknown>>;
  return Object.keys(data).length === 0 ? [] : [data];
}

function buildMarketData(
  metadata: Record<string, unknown> | null,
  listings: Array<Record<string, unknown>>,
  activities: Array<Record<string, unknown>>,
  providerFailure: boolean,
  providerMode: ProviderMode
): NftMarketData {
  if (providerFailure && !metadata && listings.length === 0 && activities.length === 0) {
    return unknownResult("PROVIDER_UNAVAILABLE", providerMode);
  }
  const listing = listings.map(nativePrice).find((value) => value !== null) ?? null;
  const sale = activities
    .filter((activity) => ["sale", "buynow", "sold"].includes(String(activity.type ?? activity.eventType ?? "").toLowerCase()))
    .map(nativePrice)
    .find((value) => value !== null) ?? null;
  const hasEvidence = listing !== null || sale !== null || listings.length > 0 || activities.length > 0;
  return {
    ...unknownResult("UNKNOWN", providerMode),
    marketExists: hasEvidence,
    status: hasEvidence ? "AVAILABLE" : "UNKNOWN",
    confidence: listing !== null && sale !== null ? "HIGH" : hasEvidence ? "MEDIUM" : "UNKNOWN",
    activityCount: activities.length,
    floorPriceNative: nestedNumber(metadata, ["floorPrice", "floor_price"]),
    bestListingNative: listing,
    recentSaleNative: sale,
    nativeCurrency: "SOL",
  };
}

export async function getMagicEdenMarketData(
  asset: Pick<AssetMetadata, "assetId" | "assetType">,
  apiKey: string | null
): Promise<NftMarketData> {
  const providerMode: ProviderMode = apiKey ? "AUTHENTICATED" : "KEYLESS";
  if (asset.assetType !== "COMPRESSED_NFT") return unknownResult("UNKNOWN", providerMode);
  const encodedId = encodeURIComponent(asset.assetId);
  try {
    const [metadataResponse, listingsResponse, activitiesResponse] = await Promise.all([
      requestJson(`${MAGIC_EDEN_API}/tokens/${encodedId}`, apiKey),
      requestJson(`${MAGIC_EDEN_API}/tokens/${encodedId}/listings`, apiKey),
      requestJson(`${MAGIC_EDEN_API}/tokens/${encodedId}/activities`, apiKey),
    ]);
    return buildMarketData(
      firstRecord(metadataResponse.data),
      records(listingsResponse.data),
      records(activitiesResponse.data),
      [metadataResponse, listingsResponse, activitiesResponse].some((response) => response.status >= 500),
      providerMode
    );
  } catch {
    return unknownResult("PROVIDER_UNAVAILABLE", providerMode);
  }
}

export async function getMagicEdenMarketDataBatch(
  assets: Array<Pick<AssetMetadata, "assetId" | "assetType">>,
  apiKey: string | null
): Promise<Map<string, NftMarketData>> {
  const unique = [...new Map(assets.map((asset) => [asset.assetId, asset])).values()];
  const results = new Map<string, NftMarketData>();
  let cursor = 0;
  const workerCount = apiKey ? Math.min(4, unique.length) : Math.min(1, unique.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < unique.length) {
        const asset = unique[cursor++];
        results.set(asset.assetId, await getMagicEdenMarketData(asset, apiKey));
      }
    })
  );
  return results;
}
