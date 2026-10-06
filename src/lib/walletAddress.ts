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
 * pipeline. Kept as a general-purpose single-address classifier (still
 * directly tested below); the combined Solana+Robinhood submission flow
 * (`POST /api/culler/scan`, `/scan`, `/rewards`) uses
 * `validateCombinedWalletSubmission` instead, since that flow has two
 * separate fields with two different requirement levels (Solana
 * required, Robinhood optional) rather than one address to classify.
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

/**
 * A single combined reward submission: a required Solana wallet (the
 * sole reward identity) plus an optional linked Robinhood/EVM wallet
 * (metadata on that submission, never a second identity). See
 * docs/culler-reward-ledger.md for the full product model.
 */
export interface CombinedWalletSubmission {
  /** Trimmed, validated Solana address. Always present. */
  solanaWallet: string;
  /** Trimmed, validated EVM address, or `null` if none was submitted
   * this time. A `null` here is a deliberate, valid state -- Robinhood
   * is optional -- never an error by itself. */
  robinhoodWallet: string | null;
}

export type CombinedWalletValidationResult =
  | { valid: true; submission: CombinedWalletSubmission }
  | { valid: false; error: string };

/**
 * Validates one combined scan/reward submission: Solana is required and
 * must be a real Solana address; Robinhood is optional, but if present
 * at all (a non-empty string after trimming) it must be a real EVM-style
 * address -- an empty/missing Robinhood field is never an error, but an
 * invalid non-empty one always is. A Robinhood address submitted with no
 * Solana address is always rejected (Solana is unconditionally
 * required, so "Robinhood only" can never pass this check) -- there is
 * no separate "reject Robinhood-only" branch because the Solana
 * requirement alone already makes that shape impossible to satisfy.
 * Both client (`/scan`, `/rewards`) and server (`POST /api/culler/scan`)
 * call this exact function, so they can never disagree about what a
 * valid submission looks like.
 */
export function validateCombinedWalletSubmission(input: {
  solanaWallet?: unknown;
  robinhoodWallet?: unknown;
}): CombinedWalletValidationResult {
  const rawSolana = input.solanaWallet;
  if (typeof rawSolana !== "string" || rawSolana.trim().length === 0) {
    return {
      valid: false,
      error: "A Solana wallet address is required for $CULLER rewards — a Robinhood address alone cannot be submitted.",
    };
  }
  const solanaWallet = rawSolana.trim();
  if (solanaWallet.length > MAX_ADDRESS_INPUT_LENGTH || !isValidSolanaAddress(solanaWallet)) {
    return { valid: false, error: "That does not look like a valid Solana wallet address." };
  }

  const rawRobinhood = input.robinhoodWallet;
  if (rawRobinhood === undefined || rawRobinhood === null) {
    return { valid: true, submission: { solanaWallet, robinhoodWallet: null } };
  }
  if (typeof rawRobinhood !== "string") {
    return { valid: false, error: "robinhoodWallet must be a string." };
  }
  const trimmedRobinhood = rawRobinhood.trim();
  if (trimmedRobinhood.length === 0) {
    return { valid: true, submission: { solanaWallet, robinhoodWallet: null } };
  }
  if (trimmedRobinhood.length > MAX_ADDRESS_INPUT_LENGTH || !isValidEvmAddress(trimmedRobinhood)) {
    return { valid: false, error: "That does not look like a valid Robinhood wallet address." };
  }

  return { valid: true, submission: { solanaWallet, robinhoodWallet: trimmedRobinhood } };
}

