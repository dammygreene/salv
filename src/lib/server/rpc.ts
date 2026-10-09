import "server-only";
import { Connection, ParsedTransactionWithMeta } from "@solana/web3.js";
import { getSolanaRpcUrl } from "./config";

/**
 * Server-only RPC endpoint. Deliberately reads a non-NEXT_PUBLIC_ env var:
 * SOLANA_RPC_URL never gets inlined into the
 * client bundle, so a provider's privileged/paid endpoint or API key can
 * live here safely. Falls back to the same public endpoint the client
 * uses if nothing is configured, so local/dev verification still works.
 */
const SERVER_SOLANA_RPC_URL = getSolanaRpcUrl();

let connection: Connection | null = null;

export function getServerConnection(): Connection {
  if (!connection) {
    connection = new Connection(SERVER_SOLANA_RPC_URL, "confirmed");
  }
  return connection;
}

export async function fetchParsedTransactionFromChain(signature: string): Promise<ParsedTransactionWithMeta | null> {
  const conn = getServerConnection();
  return conn.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
}
