/**
 * Computes exactly how many $SALV base units a reward_snapshots row is
 * worth, for a real on-chain claim. Pure and deterministic: takes only
 * the three numbers already frozen onto the immutable snapshot at the
 * moment the epoch closed (points, totalPoints, rewardPool) — it never
 * re-reads the epoch, the points ledger, or any other wallet's data.
 * This is the literal implementation of Phase 5 Section 6: "Do not
 * recalculate historical allocations from changing database state. The
 * claim amount must come from the finalized snapshot."
 *
 * Because every wallet's amount is computed independently from its own
 * frozen (points, totalPoints, rewardPool) triple using the same
 * floor-division rule, the sum of every wallet's claim amount for one
 * epoch can never exceed that epoch's reward pool in base units — the
 * same invariant proven for src/lib/salv/baseUnitAllocator.ts, since
 * this is that same per-wallet formula applied one snapshot at a time.
 */

import { salvToBaseUnits } from "./tokenSpec";

export interface SnapshotForClaim {
  points: number;
  totalPoints: number;
  /** Whole $SALV units, exactly as frozen onto the snapshot at close
   * time (the snapshot's own `rewardPool` field — see
   * src/lib/server/repositories/rewardSnapshotRepo.ts). */
  rewardPool: number;
}

export function computeClaimAmountBaseUnits(snapshot: SnapshotForClaim): bigint {
  const points = Number.isFinite(snapshot.points) && snapshot.points > 0 ? Math.trunc(snapshot.points) : 0;
  const totalPoints = Number.isFinite(snapshot.totalPoints) && snapshot.totalPoints > 0 ? Math.trunc(snapshot.totalPoints) : 0;
  const rewardPool = Number.isFinite(snapshot.rewardPool) && snapshot.rewardPool > 0 ? snapshot.rewardPool : 0;

  if (points <= 0 || totalPoints <= 0 || rewardPool <= 0) return 0n;

  const poolBaseUnits = salvToBaseUnits(rewardPool);
  return (poolBaseUnits * BigInt(points)) / BigInt(totalPoints);
}
