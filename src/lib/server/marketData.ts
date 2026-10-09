import "server-only";
import type { TokenMarketData } from "../types";
import { countEnrichmentRequest } from "./enrichmentMetrics";

const PUBLIC_SWAP_API = "https://public.jupiterapi.com";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

type PriceResponse = { data?: Record<string, { price?: number }> };
type QuoteResponse = { outAmount?: string; routePlan?: unknown[]; priceImpactPct?: string };

export async function getBatchTokenPrices(mints: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(mints)];
  if (!unique.length) return new Map();
  try {
    countEnrichmentRequest("JUPITER");
    const response = await fetch(`${PUBLIC_SWAP_API}/price?ids=${encodeURIComponent(unique.join(","))}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return new Map();
    const body = (await response.json()) as PriceResponse;
    return new Map(
      Object.entries(body.data ?? [])
        .filter(([, value]) => typeof value.price === "number" && Number.isFinite(value.price))
        .map(([mint, value]) => [mint, value.price as number])
    );
  } catch {
    return new Map();
  }
}

function probeAmount(decimals: number): string | null {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null;
  return (10n ** BigInt(decimals)).toString();
}

async function quoteMint(mint: string, decimals: number): Promise<TokenMarketData> {
  const amount = probeAmount(decimals);
  const checkedAt = new Date().toISOString();
  if (!amount) {
    return { priceUsd: null, priceStatus: "UNAVAILABLE", routeStatus: "UNKNOWN", liquidityUsd: null, volume24h: null, marketExists: null, marketAvailable: null, status: "UNKNOWN", priceImpactBps: null, source: "jupiter-public", checkedAt, confidence: "UNKNOWN" };
  }
  const url = new URL(`${PUBLIC_SWAP_API}/quote`);
  url.searchParams.set("inputMint", mint);
  url.searchParams.set("outputMint", USDC_MINT);
  url.searchParams.set("amount", amount);
  url.searchParams.set("slippageBps", "50");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      countEnrichmentRequest("JUPITER");
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (response.status === 429) {
        if (attempt === 0) continue;
        return { priceUsd: null, priceStatus: "UNAVAILABLE", routeStatus: "RATE_LIMITED", liquidityUsd: null, volume24h: null, marketExists: null, marketAvailable: null, status: "UNKNOWN", priceImpactBps: null, source: "jupiter-public", checkedAt, confidence: "UNKNOWN" };
      }
      if (response.status === 400) return { priceUsd: null, priceStatus: "UNAVAILABLE", routeStatus: "NO_ROUTE", liquidityUsd: null, volume24h: null, marketExists: false, marketAvailable: false, status: "NO_MARKET", priceImpactBps: null, source: "jupiter-public", checkedAt, confidence: "HIGH" };
      if (!response.ok) {
        if (attempt === 0 && response.status >= 500) continue;
        throw new Error(`HTTP ${response.status}`);
      }
      const body = (await response.json()) as QuoteResponse;
      const impact = body.priceImpactPct === undefined ? null : Number(body.priceImpactPct) * 100;
      return { priceUsd: null, priceStatus: "UNAVAILABLE", routeStatus: body.routePlan?.length ? "ROUTE_AVAILABLE" : "NO_ROUTE", liquidityUsd: null, volume24h: null, marketExists: Boolean(body.routePlan?.length), marketAvailable: Boolean(body.routePlan?.length), status: body.routePlan?.length ? "AVAILABLE" : "NO_MARKET", priceImpactBps: Number.isFinite(impact) ? impact : null, source: "jupiter-public", checkedAt, confidence: body.routePlan?.length ? "MEDIUM" : "HIGH" };
    } catch {
      if (attempt === 0) continue;
      return { priceUsd: null, priceStatus: "UNAVAILABLE", routeStatus: "PROVIDER_UNAVAILABLE", liquidityUsd: null, volume24h: null, marketExists: null, marketAvailable: null, status: "UNKNOWN", priceImpactBps: null, source: "jupiter-public", checkedAt, confidence: "UNKNOWN" };
    }
  }
  return { priceUsd: null, priceStatus: "UNAVAILABLE", routeStatus: "PROVIDER_UNAVAILABLE", liquidityUsd: null, volume24h: null, marketExists: null, marketAvailable: null, status: "UNKNOWN", priceImpactBps: null, source: "jupiter-public", checkedAt, confidence: "UNKNOWN" };
}

export async function getTokenMarketData(mint: string, decimals: number): Promise<TokenMarketData> {
  return quoteMint(mint, decimals);
}

export const getFungibleMarketData = getTokenMarketData;
export { probeAmount };
