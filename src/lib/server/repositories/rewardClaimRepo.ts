import "server-only";
import { Db } from "../db/types";

export type RewardClaimStatus = "CLAIMABLE" | "CLAIMED" | "FAILED";

export interface RewardClaimRecord {
  id: string;
  rewardSnapshotId: string;
  walletId: string;
  epochId: string;
  /** Integer $SALV base units (9 decimals), as a bigint. Parsed from
   * Postgres `numeric` text to avoid any floating-point precision loss
   * at 1B-supply scale (see src/lib/salv/baseUnitAllocator.ts). */
  amountBaseUnits: bigint;
  status: RewardClaimStatus;
  claimTransactionSignature: string | null;
  claimReceiptAddress: string | null;
  createdAt: string;
  claimedAt: string | null;
}

interface RewardClaimRow {
  id: string;
  reward_snapshot_id: string;
  wallet_id: string;
  epoch_id: string;
  amount_base_units: string | number;
  status: RewardClaimStatus;
  claim_transaction_signature: string | null;
  claim_receipt_address: string | null;
  created_at: string;
  claimed_at: string | null;
}

/** Parses a Postgres `numeric` column back into a bigint. Every value
 * stored in amount_base_units is written as a whole-number string by
 * this codebase, so this never has to handle a fractional numeric — it
 * defensively strips a trailing ".0"-style suffix if the driver ever
 * returns one, rather than letting BigInt() throw. */
function parseBaseUnits(raw: string | number): bigint {
  const text = String(raw);
  const whole = text.includes(".") ? text.slice(0, text.indexOf(".")) : text;
  return BigInt(whole);
}

function mapRow(row: RewardClaimRow): RewardClaimRecord {
  return {
    id: row.id,
    rewardSnapshotId: row.reward_snapshot_id,
    walletId: row.wallet_id,
    epochId: row.epoch_id,
    amountBaseUnits: parseBaseUnits(row.amount_base_units),
    status: row.status,
    claimTransactionSignature: row.claim_transaction_signature,
    claimReceiptAddress: row.claim_receipt_address,
    createdAt: row.created_at,
    claimedAt: row.claimed_at,
  };
}

export class RewardClaimError extends Error {}

export interface CreateRewardClaimInput {
  rewardSnapshotId: string;
  walletId: string;
  epochId: string;
  amountBaseUnits: bigint;
}

/**
 * Creates the CLAIMABLE claim record for one immutable reward snapshot.
 * Idempotent: a snapshot can only ever have one claim row
 * (UNIQUE reward_snapshot_id) — calling this again for the same
 * snapshot returns the existing row untouched rather than erroring or
 * duplicating it.
 */
export async function createRewardClaim(db: Db, input: CreateRewardClaimInput): Promise<{ claim: RewardClaimRecord; created: boolean }> {
  const result = await db.query<RewardClaimRow>(
    `INSERT INTO reward_claims (reward_snapshot_id, wallet_id, epoch_id, amount_base_units)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (reward_snapshot_id) DO NOTHING
     RETURNING *`,
    [input.rewardSnapshotId, input.walletId, input.epochId, input.amountBaseUnits.toString()]
  );
  if (result.rows[0]) return { claim: mapRow(result.rows[0]), created: true };

  const existing = await db.query<RewardClaimRow>("SELECT * FROM reward_claims WHERE reward_snapshot_id = $1", [input.rewardSnapshotId]);
  if (!existing.rows[0]) {
    throw new RewardClaimError("createRewardClaim: conflict reported but no existing row found.");
  }
  return { claim: mapRow(existing.rows[0]), created: false };
}

export async function getClaimById(db: Db, claimId: string): Promise<RewardClaimRecord | null> {
  const result = await db.query<RewardClaimRow>("SELECT * FROM reward_claims WHERE id = $1", [claimId]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function getClaimForSnapshot(db: Db, rewardSnapshotId: string): Promise<RewardClaimRecord | null> {
  const result = await db.query<RewardClaimRow>("SELECT * FROM reward_claims WHERE reward_snapshot_id = $1", [rewardSnapshotId]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function listClaimsForWallet(db: Db, walletId: string): Promise<RewardClaimRecord[]> {
  const result = await db.query<RewardClaimRow>("SELECT * FROM reward_claims WHERE wallet_id = $1 ORDER BY created_at DESC", [walletId]);
  return result.rows.map(mapRow);
}

export async function sumClaimedBaseUnits(db: Db): Promise<bigint> {
  const result = await db.query<{ total: string | null }>("SELECT SUM(amount_base_units) AS total FROM reward_claims WHERE status = 'CLAIMED'");
  return result.rows[0]?.total ? parseBaseUnits(result.rows[0].total) : 0n;
}

/**
 * Sum of every CLAIMABLE reward_claims row (Phase 6: `treasury_allocated_to_rewards`
 * — amounts a reward snapshot has already promised to a wallet but that
 * have not yet actually left the vault on-chain). This is a *reservation*
 * against the treasury, not a distribution: it must be subtracted from
 * "remaining" (so the treasury can never promise more than it holds),
 * but it must never be counted as `distributed` (a burn or a future
 * audit must be able to tell "promised" and "actually sent" apart).
 */
export async function sumClaimableBaseUnits(db: Db): Promise<bigint> {
  const result = await db.query<{ total: string | null }>("SELECT SUM(amount_base_units) AS total FROM reward_claims WHERE status = 'CLAIMABLE'");
  return result.rows[0]?.total ? parseBaseUnits(result.rows[0].total) : 0n;
}

export const ALREADY_CLAIMED = "ALREADY_CLAIMED" as const;

/**
 * Atomically transitions a claim from CLAIMABLE to CLAIMED, recording
 * the real on-chain transaction signature and claim-receipt address.
 * This is a compare-and-swap: the UPDATE's WHERE clause only matches a
 * row that is still CLAIMABLE, so two concurrent attempts to claim the
 * same row can never both succeed — exactly one UPDATE affects a row,
 * the other affects zero rows and this function returns ALREADY_CLAIMED
 * to the loser. Database trigger prevent_claimed_reward_claim_mutation
 * additionally guarantees a CLAIMED row can never be touched again by
 * any code path, even a buggy one that forgot this check entirely.
 */
export async function markClaimClaimed(
  db: Db,
  claimId: string,
  transactionSignature: string,
  claimReceiptAddress: string
): Promise<RewardClaimRecord | typeof ALREADY_CLAIMED> {
  const result = await db.query<RewardClaimRow>(
    `UPDATE reward_claims
     SET status = 'CLAIMED', claim_transaction_signature = $2, claim_receipt_address = $3, claimed_at = now()
     WHERE id = $1 AND status = 'CLAIMABLE'
     RETURNING *`,
    [claimId, transactionSignature, claimReceiptAddress]
  );
  if (result.rows[0]) return mapRow(result.rows[0]);
  return ALREADY_CLAIMED;
}

/** Marks a claim attempt FAILED (e.g. the on-chain transaction did not
 * confirm). A no-op (returns ALREADY_CLAIMED) if the claim has already
 * succeeded in the meantime — never downgrades a real CLAIMED claim. */
export async function markClaimFailed(db: Db, claimId: string): Promise<RewardClaimRecord | typeof ALREADY_CLAIMED> {
  const result = await db.query<RewardClaimRow>(
    `UPDATE reward_claims SET status = 'FAILED' WHERE id = $1 AND status != 'CLAIMED' RETURNING *`,
    [claimId]
  );
  if (result.rows[0]) return mapRow(result.rows[0]);
  return ALREADY_CLAIMED;
}

/** Re-opens a FAILED claim for another attempt. A no-op (returns
 * ALREADY_CLAIMED) if the claim has already succeeded in the meantime. */
export async function markClaimRetryable(db: Db, claimId: string): Promise<RewardClaimRecord | typeof ALREADY_CLAIMED> {
  const result = await db.query<RewardClaimRow>(
    `UPDATE reward_claims SET status = 'CLAIMABLE' WHERE id = $1 AND status != 'CLAIMED' RETURNING *`,
    [claimId]
  );
  if (result.rows[0]) return mapRow(result.rows[0]);
  return ALREADY_CLAIMED;
}
