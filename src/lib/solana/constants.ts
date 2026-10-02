import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Single source of truth for the SPL token program ids, taken from the
// real @solana/spl-token package so the lightweight fetch-based scanner
// and the web3.js-based executor can never drift from each other.
export { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID };
export const TOKEN_PROGRAM_ID_STR = TOKEN_PROGRAM_ID.toBase58();
export const TOKEN_2022_PROGRAM_ID_STR = TOKEN_2022_PROGRAM_ID.toBase58();

export const SOLANA_NETWORK = "mainnet-beta" as const;
