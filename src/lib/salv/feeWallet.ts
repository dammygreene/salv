import "server-only";
import { Db } from "../server/db/types";
import { FeeWalletError, FeeWalletStatus, getFeeWalletStatus, recordFeeEvent, RecordFeeEventInput } from "../server/repositories/feeWalletRepo";

export { FeeWalletError, type FeeWalletStatus };

/**
 * Records a real fee receipt into the SALVAGE FEE WALLET ledger
 * (Phase 5 Section 13). This is strictly protocol revenue — creator or
 * protocol fees earned from the launch venue — and is never mixed with
 * the Community Reward Vault (src/lib/salv/vault.ts), which exists
 * purely to pay out verified reward snapshots.
 */
export async function recordFeeReceipt(db: Db, input: Omit<RecordFeeEventInput, "direction">): Promise<ReturnType<typeof recordFeeEvent>> {
  return recordFeeEvent(db, { ...input, direction: "IN" });
}

/**
 * Records a real outflow from the fee wallet (e.g. funds moved to
 * execute a buyback, or a manual treasury withdrawal). Guards against
 * ever recording an outflow larger than the wallet's current ledger
 * balance for that asset — the ledger is the source of truth, so an
 * attempt to claim more than is actually available fails loudly instead
 * of letting the derived balance go negative.
 */
export async function recordFeeWithdrawal(db: Db, input: Omit<RecordFeeEventInput, "direction">): Promise<ReturnType<typeof recordFeeEvent>> {
  const status = await getFeeWalletStatus(db, input.asset ?? "SOL");
  if (input.amount > status.balance) {
    throw new FeeWalletError(
      `Cannot withdraw ${input.amount} ${input.asset ?? "SOL"} from the fee wallet -- only ${status.balance} is available.`
    );
  }
  return recordFeeEvent(db, { ...input, direction: "OUT" });
}

export { getFeeWalletStatus };
