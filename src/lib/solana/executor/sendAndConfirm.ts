import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";

export class ExecutionError extends Error {}

/** Shape of @solana/wallet-adapter-react's `sendTransaction`. Kept as a
 * narrow local type (instead of importing the adapter type directly) so
 * this module stays easy to unit test with a plain mock function. */
export type SendTransactionFn = (transaction: Transaction, connection: Connection) => Promise<string>;

export async function buildTransaction(
  connection: Connection,
  feePayer: PublicKey,
  instructions: TransactionInstruction[]
): Promise<{ transaction: Transaction; blockhash: string; lastValidBlockHeight: number }> {
  if (!instructions.length) {
    throw new ExecutionError("Refusing to build an empty transaction.");
  }
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({ feePayer, blockhash, lastValidBlockHeight });
  transaction.add(...instructions);
  return { transaction, blockhash, lastValidBlockHeight };
}

/** Best-effort fee estimate for display before signing. Falls back to a
 * typical single-signature fee if the RPC estimate is unavailable — this
 * is shown to the user as an estimate, never a guarantee. */
export async function estimateFeeLamports(connection: Connection, transaction: Transaction): Promise<number> {
  try {
    const message = transaction.compileMessage();
    const fee = await connection.getFeeForMessage(message, "confirmed");
    return fee.value ?? 5000;
  } catch {
    return 5000;
  }
}

export interface ExecuteResult {
  signature: string;
  slot: number | null;
}

/**
 * Sends a transaction through the connected wallet (which is the only
 * thing that ever sees/approves the actual signing) and waits for
 * cluster confirmation. Never fabricates a success result: if
 * confirmation reports an error, or the RPC call throws, this throws.
 */
export async function sendAndConfirm(
  connection: Connection,
  sendTransaction: SendTransactionFn,
  transaction: Transaction,
  blockhash: string,
  lastValidBlockHeight: number
): Promise<ExecuteResult> {
  const signature = await sendTransaction(transaction, connection);

  const confirmation = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  if (confirmation.value.err) {
    throw new ExecutionError("Transaction failed to confirm on-chain.");
  }

  const status = await connection.getSignatureStatus(signature);
  return { signature, slot: status.value?.slot ?? null };
}
