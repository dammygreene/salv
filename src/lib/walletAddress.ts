/**
 * Multi-network wallet address detection + validation for the no-wallet-
 * connect scan/rewards flow. This module never talks to a network and
 * never requires a wallet connection of any kind — it only classifies a
 * string a user pasted in.
 *
 * Supported shapes:
 *  - Solana: a base58-encoded 32-byte public key (reuses the existing,
 *    already-tested `isValidSolanaAddress` from `solana/base58.ts` — no
 *    new Solana validation logic is introduced here).
 *  - EVM / Robinhood Wallet: a standard `0x`-prefixed, 40-hex-character
 *    address. Robinhood Wallet (and most EVM chains it supports --
 *    Ethereum, Polygon, Arbitrum, Base, etc.) all share this exact
 *    address format, so "supported Robinhood address" and "EVM address"
 *    are the same shape check here. This module never attempts to
 *    "connect to" Robinhood or any EVM chain -- it only accepts the
 *    address string the user chooses to paste, exactly like Solana.
 */

import { isValidSolanaAddress } from "./solana/base58";

export type WalletNetwork = "solana" | "evm";

const EVM_ADDRESS_SHAPE = /^0x[0-9a-fA-F]{40}$/;

/** A reasonable upper bound on how long a pasted address string can be
 * before it's obviously not an address at all -- rejected before any
 * regex/decoding work runs, so an extremely large/unusual paste can
 * never cost more than a single length check. */
export const MAX_ADDRESS_INPUT_LENGTH = 128;

/** A standard EVM address: `0x` + 40 hex characters (not checksum-
 * validated -- a valid address may be all lowercase, all uppercase, or
 * mixed-case EIP-55 checksummed, and this module accepts all three
 * rather than over-restricting legitimate addresses to one casing). */
export function isValidEvmAddress(address: string): boolean {
  const trimmed = address.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ADDRESS_INPUT_LENGTH) return false;
  return EVM_ADDRESS_SHAPE.test(trimmed);
}

export interface AddressDetectionResult {
  valid: boolean;
  network: WalletNetwork | null;
  address: string;
}

/**
 * Classifies a pasted address as Solana or EVM/Robinhood, or rejects it
 * outright. Garbage, empty strings, seed phrases, and absurdly long
 * input are all rejected here rather than passed any further down the
 * pipeline -- this is the one place both the API route and the UI call,
 * so the two can never disagree about what counts as a valid address.
 */
export function detectWalletAddress(input: string): AddressDetectionResult {
  const trimmed = (input ?? "").trim();

  if (trimmed.length === 0 || trimmed.length > MAX_ADDRESS_INPUT_LENGTH) {
    return { valid: false, network: null, address: trimmed };
  }
  if (isValidSolanaAddress(trimmed)) {
    return { valid: true, network: "solana", address: trimmed };
  }
  if (isValidEvmAddress(trimmed)) {
    return { valid: true, network: "evm", address: trimmed };
  }
  return { valid: false, network: null, address: trimmed };
}
