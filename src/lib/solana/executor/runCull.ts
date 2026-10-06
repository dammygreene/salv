import { Connection, PublicKey } from "@solana/web3.js";
import { buildCloseAccountInstruction, verifyCloseAccountTarget } from "../recovery/closeAccount";
import { CullTransactionPlan } from "../transactions/types";
import { buildTransaction, SendTransactionFn, sendAndConfirm } from "./sendAndConfirm";

export interface RunCullResult {
  signature: string;
  slot: number | null;
  wallet: string;
  actions: Array<{
    assetId: string;
    tokenAccount: string;
    programId: string;
    mint: string | null;
    /** Exact lamports confirmed on-chain immediately before signing. This
     * is what was *attempted*, not proof of final recovery — that proof
     * only exists once the backend independently verifies the signature
     * (see executor/verify.ts and the /api/cull/verify route). */
    expectedRecoveryLamports: number;
  }>;
}

/**
 * Orchestrates one real on-chain cull transaction end to end:
 * 1. Re-verify every target against fresh chain state (never trust the
 *    plan's scan-time snapshot for anything safety-relevant).
 * 2. Build the real closeAccount instruction(s).
 * 3. Ask the connected wallet to sign + send.
 * 4. Wait for cluster confirmation.
 * No step here ever marks anything as a confirmed Proof of Cull —
 * that only happens once the backend verifies the resulting signature.
 */
export async function runCullPlan(
  connection: Connection,
  owner: PublicKey,
  plan: CullTransactionPlan,
  sendTransaction: SendTransactionFn
): Promise<RunCullResult> {
  if (plan.wallet !== owner.toBase58()) {
    throw new Error("Plan wallet does not match the connected wallet.");
  }

  const verifiedTargets = await Promise.all(
    plan.actions.map(async (action) => {
      const target = await verifyCloseAccountTarget(
        connection,
        owner,
        new PublicKey(action.tokenAccount),
        new PublicKey(action.programId)
      );
      return { action, target };
    })
  );

  const instructions = verifiedTargets.map(({ target }) => buildCloseAccountInstruction(target));
  const { transaction, blockhash, lastValidBlockHeight } = await buildTransaction(connection, owner, instructions);
  const result = await sendAndConfirm(connection, sendTransaction, transaction, blockhash, lastValidBlockHeight);

  return {
    signature: result.signature,
    slot: result.slot,
    wallet: owner.toBase58(),
    actions: verifiedTargets.map(({ action, target }) => ({
      assetId: action.assetId,
      tokenAccount: target.tokenAccount.toBase58(),
      programId: target.programId.toBase58(),
      mint: action.mint,
      expectedRecoveryLamports: target.lamports,
    })),
  };
}
