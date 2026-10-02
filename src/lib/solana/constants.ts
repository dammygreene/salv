import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Single source of truth for the SPL token program ids, taken from the
// real @solana/spl-token package so the lightweight fetch-based scanner
// and the web3.js-based executor can never drift from each other.
export { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID };
export const TOKEN_PROGRAM_ID_STR = TOKEN_PROGRAM_ID.toBase58();
export const TOKEN_2022_PROGRAM_ID_STR = TOKEN_2022_PROGRAM_ID.toBase58();

type SupportedNetwork = "mainnet-beta" | "devnet" | "testnet";

function readConfiguredNetwork(): SupportedNetwork {
  const raw = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOLANA_NETWORK?.trim()) || "mainnet-beta";
  if (raw === "mainnet-beta" || raw === "devnet" || raw === "testnet") return raw;
  return "mainnet-beta";
}

/** Reads NEXT_PUBLIC_SOLANA_NETWORK so the whole app (and its RPC
 * endpoint, set separately via NEXT_PUBLIC_SOLANA_RPC_URL /
 * SOLANA_RPC_URL) can be pointed at Devnet for manual testing without a
 * code change. Defaults to mainnet-beta, matching production behavior
 * when unset. */
export const SOLANA_NETWORK: SupportedNetwork = readConfiguredNetwork();
