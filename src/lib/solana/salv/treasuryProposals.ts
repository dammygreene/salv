import "server-only";
import { PublicKey, Transaction } from "@solana/web3.js";
import { createBurnCheckedInstruction, createTransferCheckedInstruction, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

/**
 * $SALV treasury proposal BUILDERS (Phase 6).
 *
 * Everything in this file does exactly one thing: construct a real,
 * correctly-formed, UNSIGNED Solana transaction that moves or burns
 * $SALV out of the community treasury. Nothing here ever signs or sends
 * one. There is no `Keypair`, no `Connection.sendTransaction`, and no
 * private key anywhere in this module — by construction, not just by
 * convention — because the treasury's authority is the 3-of-3 SPL Token
 * `Multisig` account created by `scripts/salv/create-devnet-multisig.ts`,
 * and only a quorum of that multisig's three members, signing
 * independently and out-of-band, can turn one of these built
 * transactions into a real one.
 *
 * The treasury token account's "owner" field (its authority) is always
 * the multisig account's own address. Because of that, every
 * transferChecked/burnChecked instruction below passes the multisig
 * address as `owner` and the 3 member public keys as `multiSigners` —
 * this is what tells the SPL Token program "this instruction needs M
 * of these N accounts to co-sign," per that program's native multisig
 * support (not a third-party program). A transaction built here is
 * *invalid* (will be rejected by the validator) until at least
 * `threshold` of those member keypairs actually sign it — building one
 * is therefore never equivalent to moving funds; see
 * docs/salv-treasury.md for the full explanation and
 * `src/lib/server/repositories/treasuryProposalRepo.ts` for the
 * append-only audit trail every call here should be paired with.
 */

export interface BuildTreasuryTransactionOptions {
  /** The fee payer for the transaction (pays the network fee; does NOT
   * need to be, and should not be, a treasury multisig member — any
   * funded account can pay the fee for an otherwise-unsigned proposal). */
  feePayer: PublicKey;
  /** A recent blockhash. Injected rather than fetched via a live
   * `Connection` so this module (and its tests) never require network
   * access to build a transaction — the real CLI/admin-route caller is
   * responsible for fetching a fresh one right before use, since a
   * multisig co-signing workflow can take longer than a blockhash stays
   * valid and the final submitter may need to refresh it anyway. */
  recentBlockhash: string;
  /** The 3-of-3 treasury multisig account's own address (the token
   * account authority — see module doc comment). */
  treasuryMultisig: PublicKey;
  /** All 3 treasury multisig member public keys, in any order matching
   * the on-chain Multisig account's signer list. */
  multisigMembers: [PublicKey, PublicKey, PublicKey];
  mint: PublicKey;
  decimals: number;
}

export interface BuildFundRewardVaultTransactionOptions extends BuildTreasuryTransactionOptions {
  /** The treasury's own token account (source of funds). */
  treasuryTokenAccount: PublicKey;
  /** The operational Reward Distribution Vault's token account
   * (destination) — see src/lib/solana/salv/claimExecutor.ts. */
  rewardVaultTokenAccount: PublicKey;
  amountBaseUnits: bigint;
}

/**
 * Builds an unsigned transaction that would move `amountBaseUnits` of
 * $SALV from the treasury into the operational Reward Distribution
 * Vault — the mechanism by which the 3-of-3 multisig "reserves future
 * reward allocations" (Phase 6 requirement) without the web app ever
 * being able to trigger that movement on its own authority. Building
 * this does not fund anything; the multisig members must independently
 * sign and submit the result themselves.
 */
export function buildFundRewardVaultTransaction(options: BuildFundRewardVaultTransactionOptions): Transaction {
  if (options.amountBaseUnits <= 0n) {
    throw new RangeError(`buildFundRewardVaultTransaction: amountBaseUnits must be > 0, got ${options.amountBaseUnits}.`);
  }
  const transaction = new Transaction({ feePayer: options.feePayer, recentBlockhash: options.recentBlockhash });
  transaction.add(
    createTransferCheckedInstruction(
      options.treasuryTokenAccount,
      options.mint,
      options.rewardVaultTokenAccount,
      options.treasuryMultisig,
      options.amountBaseUnits,
      options.decimals,
      options.multisigMembers,
      TOKEN_2022_PROGRAM_ID
    )
  );
  return transaction;
}

export interface BuildTreasuryBurnTransactionOptions extends BuildTreasuryTransactionOptions {
  /** The treasury's own token account to burn from. */
  treasuryTokenAccount: PublicKey;
  amountBaseUnits: bigint;
}

/**
 * Builds an unsigned transaction that would permanently burn
 * `amountBaseUnits` of $SALV directly out of the treasury's own token
 * account (`burnChecked`, not a transfer-then-burn — the tokens never
 * pass through any other account). Phase 6: "do NOT add an automatic
 * burn mechanism" — this function only ever constructs the transaction;
 * recording the *result* of an already-executed burn is a completely
 * separate, later step (`src/lib/server/repositories/treasuryBurnRepo.ts`,
 * after the multisig has actually signed, submitted, and confirmed it).
 */
export function buildTreasuryBurnTransaction(options: BuildTreasuryBurnTransactionOptions): Transaction {
  if (options.amountBaseUnits <= 0n) {
    throw new RangeError(`buildTreasuryBurnTransaction: amountBaseUnits must be > 0, got ${options.amountBaseUnits}.`);
  }
  const transaction = new Transaction({ feePayer: options.feePayer, recentBlockhash: options.recentBlockhash });
  transaction.add(
    createBurnCheckedInstruction(
      options.treasuryTokenAccount,
      options.mint,
      options.treasuryMultisig,
      options.amountBaseUnits,
      options.decimals,
      options.multisigMembers,
      TOKEN_2022_PROGRAM_ID
    )
  );
  return transaction;
}

export interface BuildTreasuryTransferTransactionOptions extends BuildTreasuryTransactionOptions {
  treasuryTokenAccount: PublicKey;
  /** Any destination token account -- e.g. a one-off giveaway payout or
   * a documented ecosystem/contributor incentive (Phase 6's permitted
   * treasury uses). Never built automatically; always a deliberate,
   * explicit admin action that still requires the 3-of-3 multisig to
   * actually sign before anything moves. */
  destinationTokenAccount: PublicKey;
  amountBaseUnits: bigint;
}

/**
 * Builds an unsigned transaction that would transfer `amountBaseUnits`
 * of $SALV from the treasury to any destination token account — the
 * general-purpose building block behind the treasury's permitted uses
 * (giveaways, documented ecosystem/contributor incentives). Like every
 * other function in this file, building one moves nothing; only the
 * 3-of-3 multisig's own signatures can.
 */
export function buildTreasuryTransferTransaction(options: BuildTreasuryTransferTransactionOptions): Transaction {
  if (options.amountBaseUnits <= 0n) {
    throw new RangeError(`buildTreasuryTransferTransaction: amountBaseUnits must be > 0, got ${options.amountBaseUnits}.`);
  }
  const transaction = new Transaction({ feePayer: options.feePayer, recentBlockhash: options.recentBlockhash });
  transaction.add(
    createTransferCheckedInstruction(
      options.treasuryTokenAccount,
      options.mint,
      options.destinationTokenAccount,
      options.treasuryMultisig,
      options.amountBaseUnits,
      options.decimals,
      options.multisigMembers,
      TOKEN_2022_PROGRAM_ID
    )
  );
  return transaction;
}

/**
 * Serializes a built (and still fully unsigned) transaction to base64,
 * for storage in `treasury_proposals.unsigned_transaction_base64` or for
 * handing to the multisig members' own wallets/tools out-of-band.
 * `requireAllSignatures: false` is required here specifically BECAUSE
 * this transaction has zero signatures yet — that is the whole point —
 * and `verifySignatures: false` because there is nothing to verify yet.
 */
export function serializeUnsignedTransaction(transaction: Transaction): string {
  return transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
}
