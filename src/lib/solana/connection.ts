import { Connection } from "@solana/web3.js";

/**
 * Browser-side RPC endpoint. Defaults to the public endpoint, which is
 * rate-limited and fine for light/demo traffic only. Point
 * NEXT_PUBLIC_SOLANA_RPC_URL at a dedicated provider for real usage.
 *
 * This value is intentionally public (NEXT_PUBLIC_*): never put a
 * provider's secret/privileged API key here. Privileged or
 * indexing-heavy RPC calls belong server-side (see src/lib/server/rpc.ts),
 * reading a non-public SOLANA_RPC_URL env var instead.
 */
export const SOLANA_RPC_ENDPOINT =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim()) ||
  "https://api.mainnet-beta.solana.com";

let sharedConnection: Connection | null = null;

export function getConnection(): Connection {
  if (!sharedConnection) {
    sharedConnection = new Connection(SOLANA_RPC_ENDPOINT, "confirmed");
  }
  return sharedConnection;
}
