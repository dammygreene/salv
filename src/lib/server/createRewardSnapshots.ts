import "server-only";
import { simulateEpochRewards } from "@/lib/cull/rewardSimulator";
import { Db } from "./db/types";
import { EpochError, getEpochByNumber, listEpochs } from "./repositories/epochRepo";
import { listWalletPointsForEpoch } from "./repositories/pointsRepo";
import { createRewardSnapshot, listSnapshotsForEpoch, RewardSnapshotRecord } from "./repositories/rewardSnapshotRepo";

export class RewardSnapshotError extends Error {}

export interface RewardSnapshotWithAddress extends RewardSnapshotRecord {
  walletAddress: string;
}

/**
 * Creates the immutable reward snapshot for every wallet that earned
 * points in `epochId`, using the exact same deterministic formula as
 * the live "simulated reward" preview (simulateEpochRewards). Only ever
 * runs against a CLOSED epoch — an epoch's final numbers must not be
 * computed (and then possibly recomputed differently) while it's still
 * ACTIVE and points could still be accruing.
 *
 * Idempotent: safe to call more than once for the same closed epoch.
 * Already-snapshotted wallets are left untouched (their row is
 * immutable, enforced by the database); only wallets without a snapshot
 * yet get one written. This does NOT transfer or allocate any real
 * token — it only records the simulated allocation.
 */
export async function createRewardSnapshotsForClosedEpoch(db: Db, epochId: string): Promise<RewardSnapshotWithAddress[]> {
  const epochs = await listEpochs(db);
  const epoch = epochs.find((e) => e.id === epochId);
  if (!epoch) {
    throw new RewardSnapshotError(`Epoch ${epochId} does not exist.`);
  }
  if (epoch.status !== "CLOSED") {
    throw new RewardSnapshotError(
      `Epoch ${epoch.number} is ${epoch.status}, not CLOSED. Reward snapshots can only be produced for a closed epoch's final numbers.`
    );
  }

  const walletPoints = await listWalletPointsForEpoch(db, epochId);
  const simulation = simulateEpochRewards(
    epoch.rewardPoolPoints,
    walletPoints.map((w) => ({ wallet: w.walletId, points: w.points }))
  );

  const addressByWalletId = new Map(walletPoints.map((w) => [w.walletId, w.walletAddress]));

  const snapshots: RewardSnapshotWithAddress[] = [];
  for (const allocation of simulation.allocations) {
    const { snapshot } = await createRewardSnapshot(db, {
      epochId,
      walletId: allocation.wallet,
      points: allocation.points,
      totalPoints: simulation.totalValidPoints,
      rewardPool: simulation.rewardPool,
      allocatedReward: allocation.estimatedReward,
    });
    snapshots.push({ ...snapshot, walletAddress: addressByWalletId.get(allocation.wallet) ?? "" });
  }
  return snapshots;
}

export async function listRewardSnapshotsForEpochNumber(db: Db, epochNumber: number): Promise<RewardSnapshotWithAddress[]> {
  const epoch = await getEpochByNumber(db, epochNumber);
  if (!epoch) throw new EpochError(`Epoch ${epochNumber} does not exist.`);
  const snapshots = await listSnapshotsForEpoch(db, epoch.id);
  const walletPoints = await listWalletPointsForEpoch(db, epoch.id);
  const addressByWalletId = new Map(walletPoints.map((w) => [w.walletId, w.walletAddress]));
  return snapshots.map((s) => ({ ...s, walletAddress: addressByWalletId.get(s.walletId) ?? "" }));
}
