import "server-only";
import { getRobinhoodChainConfig } from "./config";
import { isValidEvmAddress } from "../walletAddress";

export type RobinhoodScanState = "AVAILABLE" | "UNAVAILABLE" | "NOT_LINKED";

export interface RobinhoodScanResult {
  submitted: boolean;
  state: RobinhoodScanState;
  nativeBalanceWei: string | null;
  chainId: number;
  reason?: string;
}

export class RobinhoodScanError extends Error {}

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!response.ok) throw new RobinhoodScanError(`Robinhood Chain RPC returned HTTP ${response.status}.`);
  const body = (await response.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new RobinhoodScanError(body.error.message ?? "Robinhood Chain RPC returned an error.");
  if (body.result === undefined) throw new RobinhoodScanError("Robinhood Chain RPC returned no result.");
  return body.result;
}

export async function scanRobinhoodWallet(address: string | null): Promise<RobinhoodScanResult> {
  const config = getRobinhoodChainConfig();
  if (!address) {
    return { submitted: false, state: "NOT_LINKED", nativeBalanceWei: null, chainId: config.chainId };
  }
  if (!isValidEvmAddress(address)) {
    throw new RobinhoodScanError("That does not look like a valid Robinhood wallet address.");
  }
  if (!config.configured || !config.rpcUrl) {
    return {
      submitted: true,
      state: "UNAVAILABLE",
      nativeBalanceWei: null,
      chainId: config.chainId,
      reason: config.configurationError ?? "Robinhood Chain RPC is not configured.",
    };
  }

  try {
    const chainIdHex = await rpcCall<string>(config.rpcUrl, "eth_chainId", []);
    const observedChainId = Number.parseInt(chainIdHex, 16);
    if (observedChainId !== config.chainId) {
      throw new RobinhoodScanError(`Configured RPC reports chain ID ${observedChainId}, expected ${config.chainId}.`);
    }
    const balance = await rpcCall<string>(config.rpcUrl, "eth_getBalance", [address, "latest"]);
    if (!/^0x[0-9a-fA-F]+$/.test(balance)) throw new RobinhoodScanError("Robinhood Chain returned an invalid balance.");
    return { submitted: true, state: "AVAILABLE", nativeBalanceWei: BigInt(balance).toString(), chainId: config.chainId };
  } catch (error) {
    return {
      submitted: true,
      state: "UNAVAILABLE",
      nativeBalanceWei: null,
      chainId: config.chainId,
      reason: error instanceof Error ? error.message : "Could not read Robinhood Chain data.",
    };
  }
}
