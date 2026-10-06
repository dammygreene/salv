import { createHash } from "crypto";
import { PublicKey } from "@solana/web3.js";

/**
 * On-chain claim-receipt idempotency primitive (Phase 5 Section 7).
 *
 * A database row alone cannot be trusted as the final guarantee against
 * a duplicate claim (two processes could race, a bug could bypass the
 * check, a future distribution model might not even use this database).
 * So every real claim also creates a tiny, permanent on-chain account at
 * a deterministic address derived from (distributor pubkey, network,
 * epoch number, wallet address) via `PublicKey.createWithSeed` — no
 * custom on-chain program is required for this. The Solana runtime
 * itself refuses to create an account at an address that already holds
 * one, so attempting the same claim a second time fails at the
 * transaction level even if every off-chain check were somehow bypassed.
 *
 * `createWithSeed` seed strings are capped at 32 bytes (`MAX_SEED_LENGTH`
 * in @solana/web3.js), far shorter than a human-readable
 * "epoch+wallet address" string would be — so the seed is a 32-character
 * hex digest of those inputs, not the raw values themselves. This
 * function is pure (no RPC, no I/O) and fully deterministic, so it can
 * be unit tested and reasoned about independently of any live Devnet
 * connection.
 */

/** Deterministic 32-byte-safe seed string for one wallet's claim in one
 * epoch, scoped to a network so the same (epoch, wallet) pair on devnet
 * and mainnet-beta never collides. 16 bytes of SHA-256 digest, hex
 * encoded, is exactly 32 ASCII characters -- right at the limit. */
export function deriveClaimReceiptSeed(network: string, epochNumber: number, walletAddress: string): string {
  const digest = createHash("sha256").update(`culler-claim:${network}:${epochNumber}:${walletAddress}`).digest("hex");
  return digest.slice(0, 32);
}

/** The deterministic address a claim-receipt account for this
 * (network, epoch, wallet) triple will always be created at, owned by
 * `ownerProgramId` (the System Program for a plain marker account) and
 * funded/based on `basePublicKey` (the distributor). Calling this twice
 * with the same inputs always returns the same address -- that
 * determinism is the entire point. */
export async function deriveClaimReceiptAddress(
  basePublicKey: PublicKey,
  ownerProgramId: PublicKey,
  network: string,
  epochNumber: number,
  walletAddress: string
): Promise<PublicKey> {
  const seed = deriveClaimReceiptSeed(network, epochNumber, walletAddress);
  return PublicKey.createWithSeed(basePublicKey, seed, ownerProgramId);
}
