import "server-only";
import { Db } from "../db/types";

export interface RewardSnapshotRecord {
  id: string;
  epochId: string;
  walletId: string;
  points: number;
  totalPoints: number;
  rewardPool: number;
  allocatedReward: number;
  createdAt: string;
}

interface RewardSnapshotRow {
  id: string;
  epoch_id: string;
  wallet_id: string;
  points: number;
  total_points: string | number;
  reward_pool: string | number;
  allocated_reward: string | number;
  created_at: string;
}

function mapRow(row: RewardSnapshotRow): RewardSnapshotRecord {
  return {
    id: row.id,
    epochId: row.epoch_id,
    walletId: row.wallet_id,
    points: row.points,
    totalPoints: Number(row.total_points),
    rewardPool: Number(row.reward_pool),
    allocatedReward: Number(row.allocated_reward),
    createdAt: row.created_at,
  };
}

export interface CreateRewardSnapshotInput {
  epochId: string;
  walletId: string;
  points: number;
  totalPoints: number;
  rewardPool: number;
  allocatedReward: number;
}

/**
 * Writes one wallet's immutable reward snapshot for one epoch. Backed by
 * the real `UNIQUE (wallet_id, epoch_id)` constraint plus an append-only
 * trigger (see migrations/0002_reward_snapshots): the same wallet can
 * never receive two snapshots for the same epoch, and a written snapshot
 * can never be edited or deleted afterwards. Idempotent — calling this
 * again for a wallet/epoch pair that already has a snapshot returns the
 * existing row rather than erroring or writing a second one.
 */
export async function createRewardSnapshot(
  db: Db,
  input: CreateRewardSnapshotInput
): Promise<{ snapshot: RewardSnapshotRecord; created: boolean }> {
  const result = await db.query<RewardSnapshotRow>(
    `INSERT INTO reward_snapshots (epoch_id, wallet_id, points, total_points, reward_pool, allocated_reward)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (wallet_id, epoch_id) DO NOTHING
     RETURNING *`,
    [input.epochId, input.walletId, input.points, input.totalPoints, input.rewardPool, input.allocatedReward]
  );

  if (result.rows[0]) return { snapshot: mapRow(result.rows[0]), created: true };

  const existing = await db.query<RewardSnapshotRow>(
    "SELECT * FROM reward_snapshots WHERE wallet_id = $1 AND epoch_id = $2",
    [input.walletId, input.epochId]
  );
  if (!existing.rows[0]) {
    throw new Error("createRewardSnapshot: conflict reported but no existing row found.");
  }
  return { snapshot: mapRow(existing.rows[0]), created: false };
}

export async function listSnapshotsForEpoch(db: Db, epochId: string): Promise<RewardSnapshotRecord[]> {
  const result = await db.query<RewardSnapshotRow>(
    "SELECT * FROM reward_snapshots WHERE epoch_id = $1 ORDER BY allocated_reward DESC",
    [epochId]
  );
  return result.rows.map(mapRow);
}

export async function getSnapshotForWallet(db: Db, walletId: string, epochId: string): Promise<RewardSnapshotRecord | null> {
  const result = await db.query<RewardSnapshotRow>(
    "SELECT * FROM reward_snapshots WHERE wallet_id = $1 AND epoch_id = $2",
    [walletId, epochId]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}
