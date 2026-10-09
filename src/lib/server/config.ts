import "server-only";

export interface RobinhoodChainConfig {
  rpcUrl: string | null;
  indexerUrl: string;
  indexerApiKey: string | null;
  chainId: number;
  configured: boolean;
  configurationError: string | null;
}

export interface SolanaEnrichmentConfig {
  minTokenValueUsd: number;
  lowLiquidityPriceImpactBps: number;
  minLiquidityUsd: number | null;
  maxQuoteCandidates: number;
  openSeaApiKey: string | null;
  magicEdenApiKey: string | null;
  tokenMetadataTtlMs: number;
  nftMetadataTtlMs: number;
  tokenMarketTtlMs: number;
  nftMarketTtlMs: number;
  collectionMarketTtlMs: number;
  maxNftMarketCandidates: number;
  enrichmentTimeBudgetMs: number;
}

const ROBINHOOD_CHAIN_ID = 4663;
const DEFAULT_ROBINHOOD_INDEXER_URL = "https://robinhoodchain.blockscout.com/api/v2";
function readRpcUrl(value: string | undefined): { url: string | null; error: string | null } {
  const raw = value?.trim();
  if (!raw) return { url: null, error: null };
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { url: null, error: "ROBINHOOD_RPC_URL must use http or https." };
    }
    return { url: parsed.toString(), error: null };
  } catch {
    return { url: null, error: "ROBINHOOD_RPC_URL is not a valid URL." };
  }
}

export function getRobinhoodChainConfig(): RobinhoodChainConfig {
  const configuredRpc = process.env.ROBINHOOD_RPC_URL?.trim();
  const rpc = readRpcUrl(configuredRpc);
  const rawChainId = process.env.ROBINHOOD_CHAIN_ID?.trim() || String(ROBINHOOD_CHAIN_ID);
  const chainId = Number(rawChainId);

  if (!Number.isInteger(chainId) || chainId !== ROBINHOOD_CHAIN_ID) {
    return {
      rpcUrl: rpc.url,
      indexerUrl: process.env.ROBINHOOD_INDEXER_URL?.trim() || DEFAULT_ROBINHOOD_INDEXER_URL,
      indexerApiKey: process.env.ROBINHOOD_INDEXER_API_KEY?.trim() || null,
      chainId,
      configured: false,
      configurationError: `ROBINHOOD_CHAIN_ID must be ${ROBINHOOD_CHAIN_ID}.`,
    };
  }

  return {
    rpcUrl: rpc.url,
    indexerUrl: process.env.ROBINHOOD_INDEXER_URL?.trim() || DEFAULT_ROBINHOOD_INDEXER_URL,
    indexerApiKey: process.env.ROBINHOOD_INDEXER_API_KEY?.trim() || null,
    chainId,
    configured: Boolean(configuredRpc) && !rpc.error,
    configurationError: rpc.error,
  };
}

export { ROBINHOOD_CHAIN_ID };

export function getSolanaEnrichmentConfig(): SolanaEnrichmentConfig {
  const rawThreshold = process.env.CULLER_MIN_VALUE_USD?.trim() || process.env.CULLER_MIN_TOKEN_VALUE_USD?.trim();
  const parsedThreshold = rawThreshold === undefined || rawThreshold === "" ? 0.01 : Number(rawThreshold);
  const rawLiquidity = process.env.CULLER_MIN_LIQUIDITY_USD?.trim();
  const parsedLiquidity = rawLiquidity ? Number(rawLiquidity) : null;
  return {
    minTokenValueUsd: Number.isFinite(parsedThreshold) && parsedThreshold >= 0 ? parsedThreshold : 0.01,
    lowLiquidityPriceImpactBps: Number(process.env.CULLER_LOW_LIQUIDITY_PRICE_IMPACT_BPS || 500),
    minLiquidityUsd: parsedLiquidity !== null && Number.isFinite(parsedLiquidity) && parsedLiquidity >= 0 ? parsedLiquidity : null,
    maxQuoteCandidates: Number(process.env.CULLER_MAX_QUOTE_CANDIDATES || 24),
    openSeaApiKey: process.env.OPENSEA_API_KEY?.trim() || null,
    magicEdenApiKey: process.env.MAGIC_EDEN_API_KEY?.trim() || null,
    tokenMetadataTtlMs: readTtl("CULLER_TOKEN_METADATA_TTL_MS", 24 * 60 * 60 * 1000),
    nftMetadataTtlMs: readTtl("CULLER_NFT_METADATA_TTL_MS", 24 * 60 * 60 * 1000),
    tokenMarketTtlMs: readTtl("CULLER_TOKEN_MARKET_TTL_MS", 15 * 60 * 1000),
    nftMarketTtlMs: readTtl("CULLER_NFT_MARKET_TTL_MS", 30 * 60 * 1000),
    collectionMarketTtlMs: readTtl("CULLER_COLLECTION_MARKET_TTL_MS", 30 * 60 * 1000),
    maxNftMarketCandidates: readPositiveInteger("CULLER_MAX_NFT_MARKET_CANDIDATES", 24),
    enrichmentTimeBudgetMs: readPositiveInteger("CULLER_ENRICHMENT_TIME_BUDGET_MS", 45_000),
  };
}

function readTtl(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function getSolanaRpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
    "https://api.mainnet-beta.solana.com"
  );
}

export function getCullerTokensPerPoint(): bigint | null {
  const raw = process.env.CULLER_TOKENS_PER_POINT?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = BigInt(raw);
  return value > 0n ? value : null;
}
