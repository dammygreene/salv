import "server-only";
import type { TokenMarketData } from "../types";

/**
 * Provider-neutral market-data contract. QuickNode DAS currently supplies
 * neither liquidity nor a reliable no-market signal for this deployment, so
 * callers must retain UNKNOWN until a configured provider can prove otherwise.
 */
export async function getTokenMarketData(mint: string): Promise<TokenMarketData> {
  void mint;
  return {
    priceUsd: null,
    liquidityUsd: null,
    marketAvailable: null,
    status: "UNKNOWN",
    source: "unavailable",
  };
}
