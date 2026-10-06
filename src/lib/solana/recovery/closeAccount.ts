import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { createCloseAccountInstruction, getAccount } from "@solana/spl-token";

export class RecoveryValidationError extends Error {}

export interface VerifiedCloseTarget {
  tokenAccount: PublicKey;
  programId: PublicKey;
  owner: PublicKey;
  /** Fresh lamport balance of the account right now, i.e. exactly what
   * closing it will return to the owner (minus nothing — close refunds
   * the full rent-exempt balance to the destination). */
  lamports: number;
}

/**
 * Re-verifies a token account's on-chain state immediately before it is
 * allowed into a transaction. This NEVER trusts scan-time cached data:
 * a scan result could be seconds or minutes old, and in that window the
 * account could have been topped up, closed already, frozen, or have
 * changed owner. Every safety-relevant fact is re-derived from a fresh
 * RPC read right here.
 */
export async function verifyCloseAccountTarget(
  connection: Connection,
  expectedOwner: PublicKey,
  tokenAccountAddress: PublicKey,
  programId: PublicKey
): Promise<VerifiedCloseTarget> {
  let account;
  try {
    account = await getAccount(connection, tokenAccountAddress, "confirmed", programId);
  } catch (err) {
    throw new RecoveryValidationError(
      `Could not read the token account from chain (it may already be closed): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  if (!account.owner.equals(expectedOwner)) {
    throw new RecoveryValidationError("Token account owner no longer matches the connected wallet.");
  }
  if (account.amount !== BigInt(0)) {
    throw new RecoveryValidationError("Token account is no longer empty; refusing to close it.");
  }
  if (account.isFrozen) {
    throw new RecoveryValidationError("Token account is frozen and cannot be closed.");
  }

  const info = await connection.getAccountInfo(tokenAccountAddress, "confirmed");
  if (!info) {
    throw new RecoveryValidationError("Token account no longer exists on chain.");
  }
  if (!info.owner.equals(programId)) {
    throw new RecoveryValidationError("Token account is not owned by the expected SPL token program.");
  }

  return {
    tokenAccount: tokenAccountAddress,
    programId,
    owner: expectedOwner,
    lamports: info.lamports,
  };
}

/** Builds the real SPL Token closeAccount instruction: rent lamports are
 * sent back to the owner itself (destination === owner), never to any
 * third-party or protocol-controlled address. */
export function buildCloseAccountInstruction(target: VerifiedCloseTarget): TransactionInstruction {
  return createCloseAccountInstruction(target.tokenAccount, target.owner, target.owner, [], target.programId);
}
