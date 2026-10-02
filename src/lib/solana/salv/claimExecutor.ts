import "server-only";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ClaimExecutionResult, ClaimExecutor } from "@/lib/salv/claims";
import { deriveClaimReceiptAddress, deriveClaimReceiptSeed } from "./claimReceipt";

/**
 * The real on-chain implementation of src/lib/salv/claims.ts's injected
 * ClaimExecutor. This is the only place in the codebase that actually
 * builds and sends a $SALV claim transaction.
 *
 * Every transaction this builds does two things atomically (both
 * instructions must succeed together, or neither does):
 *
 *  1. Create the deterministic claim-receipt account (see
 *     claimReceipt.ts) via `SystemProgram.createAccountWithSeed`. If a
 *     receipt for this (network, epoch, wallet) already exists on-chain
 *     — because this exact claim already went through, even if that
 *     happened through a different, concurrent request this server
 *     never learned succeeded — this instruction fails and the whole
 *     transaction is rejected by the validator. This is real on-chain
 *     duplicate-claim prevention, independent of this application's own
 *     database (Phase 5 Section 7).
 *  2. Transfer the claimed amount of $SALV from the Community Reward
 *     Vault's token account to the claiming wallet's associated token
 *     account (created idempotently if it doesn't exist yet).
 *
 * Devnet simplification, documented honestly: the vault's token account
 * is owned directly by the distributor keypair (a single hot wallet),
 * not by a dedicated on-chain program or a multisig. This is acceptable
 * for a Devnet rehearsal of the mechanism; launch.md's "use multisig for
 * administrative treasury controls when possible" should be revisited
 * before any mainnet deployment of this vault design.
 *
 * This function requires a real, reachable Solana RPC endpoint. It
 * cannot be exercised in this sandbox (no outbound network access to any
 * Solana cluster) — the same constraint documented for Phase 4 Part A.
 * Its correctness is instead covered by: (a) claimReceipt.test.ts, which
 * tests the deterministic address derivation this function relies on in
 * complete isolation from any network call, and (b) claims.test.ts,
 * which tests every orchestration/idempotency rule this function's
 * caller depends on using an injected fake executor.
 */
export function createOnChainClaimExecutor(options: {
  connection: Connection;
  distributor: Keypair;
  network: string;
  mintAddress: string;
  decimals: number;
  rewardVaultTokenAccount: string;
}): ClaimExecutor {
  const mint = new PublicKey(options.mintAddress);
  const vaultTokenAccount = new PublicKey(options.rewardVaultTokenAccount);

  return async ({ walletAddress, epochNumber, amountBaseUnits }): Promise<ClaimExecutionResult> => {
    const walletPubkey = new PublicKey(walletAddress);
    const seed = deriveClaimReceiptSeed(options.network, epochNumber, walletAddress);
    const claimReceiptAddress = await deriveClaimReceiptAddress(
      options.distributor.publicKey,
      SystemProgram.programId,
      options.network,
      epochNumber,
      walletAddress
    );

    const destinationAta = await getAssociatedTokenAddress(mint, walletPubkey);

    const rentExemptMinimum = await options.connection.getMinimumBalanceForRentExemption(0);

    const transaction = new Transaction().add(
      // (1) The on-chain idempotency marker. Fails the whole transaction
      // if this exact (network, epoch, wallet) claim was ever created
      // before.
      SystemProgram.createAccountWithSeed({
        fromPubkey: options.distributor.publicKey,
        basePubkey: options.distributor.publicKey,
        seed,
        newAccountPubkey: claimReceiptAddress,
        lamports: rentExemptMinimum,
        space: 0,
        programId: SystemProgram.programId,
      }),
      // (2) Create the destination ATA if it doesn't exist yet (no-op
      // otherwise).
      createAssociatedTokenAccountIdempotentInstruction(options.distributor.publicKey, destinationAta, walletPubkey, mint),
      // (3) The actual transfer out of the vault. transferChecked (not
      // plain transfer) so a decimals mismatch between what this caller
      // believes and what the mint actually has fails loudly instead of
      // silently moving the wrong amount.
      createTransferCheckedInstruction(
        vaultTokenAccount,
        mint,
        destinationAta,
        options.distributor.publicKey,
        amountBaseUnits,
        options.decimals,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const signature = await sendAndConfirmTransaction(options.connection, transaction, [options.distributor], {
      commitment: "confirmed",
    });

    return { transactionSignature: signature, claimReceiptAddress: claimReceiptAddress.toBase58() };
  };
}
