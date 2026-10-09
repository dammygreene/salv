import "server-only";
import { Db } from "../server/db/types";
import { EpochError, getEpochByNumber } from "../server/repositories/epochRepo";
import { getSnapshotForWallet, RewardSnapshotRecord } from "../server/repositories/rewardSnapshotRepo";
import { ensureWallet } from "../server/repositories/walletRepo";
import { computeClaimAmountBaseUnits } from "./claimAmount";
import { calculateFixedAllocationBaseUnits } from "../cull/fixedAllocation";

export type ClaimViewStatus = "NO_SNAPSHOT" | "CLAIMABLE";

export interface ClaimView {
  status: ClaimViewStatus;
  amountBaseUnits: bigint;
  snapshot: RewardSnapshotRecord | null;
  claim: null;
}

/** Read-only authoritative allocation view. The app records this allocation
 * only; it never creates, signs, or submits token claims. */
export async function getClaimView(db: Db, walletAddress: string, epochNumber: number): Promise<ClaimView> {
  const epoch = await getEpochByNumber(db, epochNumber);
  if (!epoch) throw new EpochError(`Epoch ${epochNumber} does not exist.`);

  const wallet = await ensureWallet(db, walletAddress);
  const snapshot = await getSnapshotForWallet(db, wallet.id, epoch.id);
  if (!snapshot) {
    return { status: "NO_SNAPSHOT", amountBaseUnits: 0n, snapshot: null, claim: null };
  }

  return {
    status: "CLAIMABLE",
    amountBaseUnits: epoch.conversionRate === null
      ? computeClaimAmountBaseUnits(snapshot)
      : calculateFixedAllocationBaseUnits(snapshot.points, epoch.conversionRate),
    snapshot,
    claim: null,
  };
}
