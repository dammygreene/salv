import "server-only";
import { Db } from "../server/db/types";
import { EpochError, getEpochByNumber } from "../server/repositories/epochRepo";
import {
  ALREADY_CLAIMED,
  createRewardClaim,
  getClaimForSnapshot,
  listClaimsForWallet,
  markClaimClaimed,
  markClaimFailed,
  markClaimRetryable,
  RewardClaimRecord,
} from "../server/repositories/rewardClaimRepo";
import { getSnapshotForWallet, listSnapshotsForEpoch, RewardSnapshotRecord } from "../server/repositories/rewardSnapshotRepo";
import { ensureWallet } from "../server/repositories/walletRepo";
import { computeClaimAmountBaseUnits } from "./claimAmount";

export class ClaimError extends Error {}

/**
 * Creates (or reuses) the CLAIMABLE reward_claims row for every immutable
 * snapshot in a closed epoch, computing each wallet's amount strictly
 * from that wallet's own frozen snapshot (see
 * src/lib/culler/claimAmount.ts) — never from live epoch/points state.
 * Idempotent and safe to call repeatedly (e.g. once right after epoch
 * close, and again on demand): createRewardClaim() no-ops for a snapshot
 * that already has a claim row.
 */
export async function createClaimsForEpochSnapshots(db: Db, epochId: string): Promise<RewardClaimRecord[]> {
  const snapshots = await listSnapshotsForEpoch(db, epochId);
  const claims: RewardClaimRecord[] = [];
  for (const snapshot of snapshots) {
    const amount = computeClaimAmountBaseUnits({
      points: snapshot.points,
      totalPoints: snapshot.totalPoints,
      rewardPool: snapshot.rewardPool,
    });
    const { claim } = await createRewardClaim(db, {
      rewardSnapshotId: snapshot.id,
      walletId: snapshot.walletId,
      epochId,
      amountBaseUnits: amount,
    });
    claims.push(claim);
  }
  return claims;
}

export type ClaimViewStatus = "NO_SNAPSHOT" | "CLAIMABLE" | "CLAIMED" | "FAILED";

export interface ClaimView {
  status: ClaimViewStatus;
  amountBaseUnits: bigint;
  snapshot: RewardSnapshotRecord | null;
  claim: RewardClaimRecord | null;
}

/** Read-only view of one wallet's claim standing for one epoch — used by
 * the rewards page and the claim API route. Never creates anything; a
 * wallet with points but no snapshot/claim row yet (epoch not closed, or
 * createClaimsForEpochSnapshots not run yet) is reported as NO_SNAPSHOT,
 * not fabricated as claimable. */
export async function getClaimView(db: Db, walletAddress: string, epochNumber: number): Promise<ClaimView> {
  const epoch = await getEpochByNumber(db, epochNumber);
  if (!epoch) throw new EpochError(`Epoch ${epochNumber} does not exist.`);

  const wallet = await ensureWallet(db, walletAddress);
  const snapshot = await getSnapshotForWallet(db, wallet.id, epoch.id);
  if (!snapshot) {
    return { status: "NO_SNAPSHOT", amountBaseUnits: 0n, snapshot: null, claim: null };
  }

  const claim = await getClaimForSnapshot(db, snapshot.id);
  if (!claim) {
    // Snapshot exists but createClaimsForEpochSnapshots hasn't run for it
    // yet -- report the amount it WOULD be claimable for once it has,
    // without ever claiming to be in a CLAIMABLE on-chain state.
    return { status: "NO_SNAPSHOT", amountBaseUnits: computeClaimAmountBaseUnits(snapshot), snapshot, claim: null };
  }

  return { status: claim.status === "CLAIMABLE" ? "CLAIMABLE" : claim.status, amountBaseUnits: claim.amountBaseUnits, snapshot, claim };
}

export async function listClaimsForWalletAddress(db: Db, walletAddress: string): Promise<RewardClaimRecord[]> {
  const wallet = await ensureWallet(db, walletAddress);
  return listClaimsForWallet(db, wallet.id);
}

export interface ClaimExecutionResult {
  transactionSignature: string;
  claimReceiptAddress: string;
}

/** The real on-chain execution step is injected so the orchestration
 * below (eligibility, idempotency, DB state transitions) is fully
 * testable without a live Solana RPC connection — see
 * src/lib/solana/culler/claimExecutor.ts for the real implementation,
 * which this sandbox cannot exercise end-to-end for the same reason
 * Phase 4 Part A is open (no outbound network access here). */
export type ClaimExecutor = (input: {
  walletAddress: string;
  epochNumber: number;
  amountBaseUnits: bigint;
}) => Promise<ClaimExecutionResult>;

export type AttemptClaimResult =
  | { outcome: "CLAIMED"; claim: RewardClaimRecord }
  | { outcome: "ALREADY_CLAIMED"; claim: RewardClaimRecord | null }
  | { outcome: "NOT_CLAIMABLE"; reason: string }
  | { outcome: "ZERO_AMOUNT" }
  | { outcome: "EXECUTION_FAILED"; error: string };

/**
 * The single entry point for "claim this wallet's $CULLER for this
 * epoch." Never fakes success: the executor must actually confirm a
 * real transaction before this function records CLAIMED. A wallet can
 * reach CLAIMED exactly once — a second call always short-circuits to
 * ALREADY_CLAIMED before the executor is ever invoked a second time, and
 * a race between two concurrent calls for the same claim is resolved by
 * the database's compare-and-swap UPDATE in markClaimClaimed (only one
 * can win; see src/lib/server/repositories/rewardClaimRepo.ts).
 */
export async function attemptClaim(
  db: Db,
  walletAddress: string,
  epochNumber: number,
  executeClaim: ClaimExecutor
): Promise<AttemptClaimResult> {
  const view = await getClaimView(db, walletAddress, epochNumber);

  if (view.status === "NO_SNAPSHOT") {
    return { outcome: "NOT_CLAIMABLE", reason: "No finalized reward snapshot exists yet for this wallet and epoch." };
  }
  if (view.status === "CLAIMED") {
    return { outcome: "ALREADY_CLAIMED", claim: view.claim };
  }
  if (view.amountBaseUnits <= 0n) {
    // Never submit a real on-chain transaction to move zero tokens.
    return { outcome: "ZERO_AMOUNT" };
  }
  if (!view.claim) {
    return { outcome: "NOT_CLAIMABLE", reason: "Claim record has not been created for this snapshot yet." };
  }

  if (view.claim.status === "FAILED") {
    // A previous attempt's on-chain transaction did not confirm. Re-open
    // it for this attempt rather than leaving it permanently stuck —
    // FAILED is never a terminal state (only CLAIMED is).
    const reopened = await markClaimRetryable(db, view.claim.id);
    if (reopened === ALREADY_CLAIMED) {
      return { outcome: "ALREADY_CLAIMED", claim: await getClaimForSnapshot(db, view.snapshot!.id) };
    }
  }

  try {
    const result = await executeClaim({ walletAddress, epochNumber, amountBaseUnits: view.amountBaseUnits });
    const updated = await markClaimClaimed(db, view.claim.id, result.transactionSignature, result.claimReceiptAddress);
    if (updated === ALREADY_CLAIMED) {
      // Lost a race to a concurrent claim attempt between our read and
      // our write. The on-chain transaction we just sent will itself
      // fail at the claim-receipt-account step (it is a deterministic,
      // already-created address) if the other attempt was also a real
      // on-chain claim, so no double-spend of the vault is possible
      // either way.
      return { outcome: "ALREADY_CLAIMED", claim: await getClaimForSnapshot(db, view.snapshot!.id) };
    }
    return { outcome: "CLAIMED", claim: updated };
  } catch (err) {
    await markClaimFailed(db, view.claim.id);
    return { outcome: "EXECUTION_FAILED", error: err instanceof Error ? err.message : String(err) };
  }
}
