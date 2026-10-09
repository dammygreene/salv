/**
 * Thin JSON-RPC client for the Solana blockchain. No SDK dependency: a
 * read-only wallet scanner only needs a handful of RPC methods, and a
 * raw fetch() keeps the client bundle small and avoids Node-polyfill
 * issues some Solana SDKs pull into the browser build.
 *
 * Point NEXT_PUBLIC_SOLANA_RPC_URL at the configured QuickNode endpoint
 * for production use. The public default
 * endpoint is rate-limited and should not be used for production load.
 */

import { SOLANA_RPC_ENDPOINT } from "../connection";
import { TOKEN_2022_PROGRAM_ID_STR, TOKEN_PROGRAM_ID_STR } from "../constants";

export { SOLANA_RPC_ENDPOINT };
export const TOKEN_PROGRAM_ID = TOKEN_PROGRAM_ID_STR;
export const TOKEN_2022_PROGRAM_ID = TOKEN_2022_PROGRAM_ID_STR;
const SERVER_RPC_ENDPOINT =
  typeof window === "undefined" ? process.env.SOLANA_RPC_URL?.trim() || SOLANA_RPC_ENDPOINT : SOLANA_RPC_ENDPOINT;

export class SolanaRpcError extends Error {}

let requestId = 0;

async function rpcCall<T>(method: string, params: unknown[], timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  requestId += 1;

  try {
    const res = await fetch(SERVER_RPC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new SolanaRpcError(`RPC request failed (HTTP ${res.status})`);
    }

    const json = (await res.json()) as { result?: T; error?: { message: string; code: number } };
    if (json.error) {
      throw new SolanaRpcError(json.error.message || "RPC returned an error");
    }
    return json.result as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new SolanaRpcError("Solana RPC request timed out");
    }
    if (err instanceof SolanaRpcError) throw err;
    throw new SolanaRpcError("Could not reach the Solana RPC endpoint");
  } finally {
    clearTimeout(timeout);
  }
}

export interface ParsedTokenAmount {
  amount: string;
  decimals: number;
  uiAmount: number | null;
  uiAmountString: string;
}

export interface ParsedTokenAccountInfo {
  mint: string;
  owner: string;
  state: string;
  tokenAmount: ParsedTokenAmount;
}

export interface TokenAccountEntry {
  pubkey: string;
  account: {
    lamports: number;
    data: { program: string; parsed: { info: ParsedTokenAccountInfo; type: string } };
  };
}

interface TokenAccountsByOwnerResult {
  value: TokenAccountEntry[];
}

export async function getTokenAccountsByOwner(owner: string, programId: string): Promise<TokenAccountEntry[]> {
  const result = await rpcCall<TokenAccountsByOwnerResult>("getTokenAccountsByOwner", [
    owner,
    { programId },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  return result.value;
}

interface SignatureInfo {
  signature: string;
  blockTime: number | null;
}

export async function getLatestActivityBlockTime(address: string): Promise<number | null> {
  const result = await rpcCall<SignatureInfo[]>("getSignaturesForAddress", [address, { limit: 1 }], 8000);
  return result[0]?.blockTime ?? null;
}

export async function getSolBalanceLamports(address: string): Promise<number> {
  const result = await rpcCall<{ value: number }>("getBalance", [address, { commitment: "confirmed" }]);
  return result.value;
}
