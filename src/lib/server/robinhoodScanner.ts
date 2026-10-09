import "server-only";
import { getRobinhoodChainConfig } from "./config";
import { isValidEvmAddress } from "../walletAddress";
import type { Asset } from "../types";

export type RobinhoodScanState = "AVAILABLE" | "UNAVAILABLE" | "NOT_LINKED";
export type RobinhoodDiscoveryState = "COMPLETE" | "PARTIAL" | "EMPTY" | "UNAVAILABLE";

export interface RobinhoodScanResult {
  submitted: boolean;
  state: RobinhoodScanState;
  discovery: RobinhoodDiscoveryState;
  nativeBalanceWei: string | null;
  assets: Asset[];
  assetCounts: { native: number; erc20: number; erc721: number; erc1155: number };
  chainId: number;
  reason?: string;
}

export class RobinhoodScanError extends Error {}

type RpcResponse<T> = { result?: T; error?: { message?: string; code?: number } };
type TokenItem = {
  address?: string;
  token?: { address?: string; name?: string; symbol?: string; decimals?: number; type?: string; icon_url?: string | null };
  value?: string;
  token_id?: string;
  token_type?: string;
};
type IndexerResponse = { items?: TokenItem[]; next_page_params?: Record<string, string | number> | null };

const REQUEST_TIMEOUT_MS = 15_000;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new RobinhoodScanError(`Robinhood asset provider returned HTTP ${response.status}.`);
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof RobinhoodScanError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new RobinhoodScanError("Robinhood asset provider timed out.");
    }
    throw new RobinhoodScanError("Robinhood asset provider could not be reached.");
  } finally {
    clearTimeout(timeout);
  }
}

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const body = await fetchJson<RpcResponse<T>>(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (body.error) throw new RobinhoodScanError(body.error.message ?? "Robinhood Chain RPC returned an error.");
  if (body.result === undefined) throw new RobinhoodScanError("Robinhood Chain RPC returned no result.");
  return body.result;
}

function tokenAsset(item: TokenItem): Asset | null {
  const token = item.token ?? {};
  const address = token.address ?? item.address;
  if (!address) return null;
  const tokenId = item.token_id;
  const standardText = token.type ?? item.token_type ?? "";
  const tokenStandard: Asset["tokenStandard"] = /1155/i.test(standardText) ? "ERC-1155" : /721/i.test(standardText) || tokenId ? "ERC-721" : "ERC-20";
  const kind: "TOKEN" | "NFT" = tokenStandard === "ERC-20" ? "TOKEN" : "NFT";
  const id = `robinhood:${address.toLowerCase()}:${tokenId ?? "fungible"}`;
  const isNft = kind === "NFT";
  const classification = isNft ? "NFT_UNKNOWN_VALUE" : "FUNGIBLE_UNKNOWN_VALUE";
  return {
    id,
    network: "robinhood",
    tokenStandard,
    name: token.name || (isNft ? "Robinhood NFT" : "Unknown token"),
    ticker: token.symbol || (isNft ? "NFT" : "TOKEN"),
    kind,
    address: tokenId ? `${address}:${tokenId}` : address,
    status: "REVIEW",
    age: "Discovered now",
    value: item.value ?? "0",
    valueKnown: false,
    reason: "Robinhood Chain asset discovered by the indexed wallet provider; market data is not available.",
    action: "Review asset",
    rawBalance: item.value,
    decimals: token.decimals,
    valueClassification: classification,
    eligibility: "CANDIDATE",
    eligibilityEvidence: {
      assetType: isNft ? "NFT" : "FUNGIBLE",
      classification,
      eligibility: "CANDIDATE",
      confidence: "UNKNOWN",
      priceUsd: null,
      estimatedValueUsd: null,
      liquidityUsd: null,
      priceSource: null,
      liquiditySource: null,
      routeStatus: null,
      priceImpactBps: null,
      marketplace: null,
      floorUsd: null,
      bestListingUsd: null,
      bestOfferUsd: null,
      evidenceSources: ["robinhood-blockscout"],
      checkedAt: new Date().toISOString(),
    },
    metadata: {
      assetType: isNft ? "NFT" : "FUNGIBLE",
      imageUrl: token.icon_url ?? null,
      collection: token.name ?? null,
      collectionAddress: address,
      verifiedCollection: null,
      priceUsd: null,
      valueUsd: null,
      marketStatus: "UNKNOWN",
      metadataStatus: "AVAILABLE",
      source: "robinhood-blockscout",
    },
  };
}

async function indexedAssets(indexerUrl: string, indexerApiKey: string | null, address: string): Promise<Asset[]> {
  const assets: Asset[] = [];
  let next: Record<string, string | number> | null = null;
  do {
    const url = new URL(`${indexerUrl.replace(/\/$/, "")}/addresses/${address}/tokens`);
    for (const [key, value] of Object.entries(next ?? {})) url.searchParams.set(key, String(value));
    const page = await fetchJson<IndexerResponse>(url.toString(), indexerApiKey ? { headers: { "x-api-key": indexerApiKey } } : undefined);
    for (const item of page.items ?? []) {
      const asset = tokenAsset(item);
      if (asset) assets.push(asset);
    }
    next = page.next_page_params ?? null;
  } while (next);
  return assets;
}

export async function scanRobinhoodWallet(address: string | null): Promise<RobinhoodScanResult> {
  const config = getRobinhoodChainConfig();
  if (!address) return { submitted: false, state: "NOT_LINKED", discovery: "EMPTY", nativeBalanceWei: null, assets: [], assetCounts: { native: 0, erc20: 0, erc721: 0, erc1155: 0 }, chainId: config.chainId };
  if (!isValidEvmAddress(address)) throw new RobinhoodScanError("That does not look like a valid Robinhood wallet address.");
  const unavailable = (reason: string): RobinhoodScanResult => ({
    submitted: true, state: "UNAVAILABLE", discovery: "UNAVAILABLE", nativeBalanceWei: null, assets: [], assetCounts: { native: 0, erc20: 0, erc721: 0, erc1155: 0 }, chainId: config.chainId, reason,
  });
  if (!config.configured || !config.rpcUrl) return unavailable(config.configurationError ?? "Robinhood Chain RPC is not configured.");

  try {
    const chainIdHex = await rpcCall<string>(config.rpcUrl, "eth_chainId", []);
    const observedChainId = Number.parseInt(chainIdHex, 16);
    if (observedChainId !== config.chainId) throw new RobinhoodScanError(`Configured RPC reports chain ID ${observedChainId}, expected ${config.chainId}.`);
    const balance = await rpcCall<string>(config.rpcUrl, "eth_getBalance", [address, "latest"]);
    if (!/^0x[0-9a-fA-F]+$/.test(balance)) throw new RobinhoodScanError("Robinhood Chain returned an invalid balance.");
    const assets: Asset[] = [];
    if (BigInt(balance) > 0n) {
      assets.push({
        id: `robinhood:native:${address.toLowerCase()}`,
        network: "robinhood",
        tokenStandard: "NATIVE",
        name: "Robinhood Chain native balance",
        ticker: "ETH",
        kind: "TOKEN",
        address: "native",
        status: "REVIEW",
        age: "Discovered now",
        value: balance,
        valueKnown: false,
        reason: "Native Robinhood Chain balance; market data is not available.",
        action: "Review asset",
        rawBalance: BigInt(balance).toString(),
        decimals: 18,
        valueClassification: "FUNGIBLE_UNKNOWN_VALUE",
        eligibility: "CANDIDATE",
      });
    }
    const tokenResult = await Promise.allSettled([indexedAssets(config.indexerUrl, config.indexerApiKey, address)]);
    const indexed = tokenResult[0].status === "fulfilled" ? tokenResult[0].value : [];
    const all = [...assets, ...indexed];
    const assetCounts = {
      native: assets.length,
      erc20: indexed.filter((asset) => asset.kind === "TOKEN").length,
      erc721: indexed.filter((asset) => asset.tokenStandard === "ERC-721").length,
      erc1155: indexed.filter((asset) => asset.tokenStandard === "ERC-1155").length,
    };
    const failures = tokenResult.filter((result) => result.status === "rejected");
    const reason = failures.length
      ? "Robinhood Chain discovery was partial: " +
        failures.map((failure) => failure.reason instanceof Error ? failure.reason.message : "an asset category could not be checked.").join(" ")
      : undefined;
    return {
      submitted: true,
      state: "AVAILABLE",
      discovery: failures.length ? "PARTIAL" : all.length ? "COMPLETE" : "EMPTY",
      nativeBalanceWei: BigInt(balance).toString(),
      assets: all,
      assetCounts,
      chainId: config.chainId,
      ...(reason ? { reason } : {}),
    };
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : "Could not read Robinhood Chain data.");
  }
}
