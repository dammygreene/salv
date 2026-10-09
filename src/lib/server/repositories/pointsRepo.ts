import "server-only";
import { Db } from "../db/types";

export interface PointsEntryRecord {
  id: string;
  walletId: string;
  cullActionId: string;
  epochId: string | null;
  points: number;
  reason: string;
  createdAt: string;
}

interface PointsEntryRow {
  id: string;
  wallet_id: string;
  salvage_action_id: string;
  epoch_id: string | null;
  points: number;
  reason: string;
  created_at: string;
}

function mapRow(row: PointsEntryRow): PointsEntryRecord {
  return {
    id: row.id,
    walletId: row.wallet_id,
    cullActionId: row.salvage_action_id,
    epochId: row.epoch_id,
    points: row.points,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

/**
 * Appends a points entry. Every point in this system traces back to
 * exactly one VERIFIED cull_action via the UNIQUE(salvage_action_id)
 * constraint — this function is idempotent on that id: calling it twice
 * for the same action never double-counts.
 */
export async function awardPoints(
  db: Db,
  input: { walletId: string; cullActionId: string; points: number; reason: string; epochId: string | null }
): Promise<{ entry: PointsEntryRecord; created: boolean }> {
  const result = await db.query<PointsEntryRow>(
    `INSERT INTO points_ledger (wallet_id, salvage_action_id, epoch_id, points, reason)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (salvage_action_id) DO NOTHING
     RETURNING *`,
    [input.walletId, input.cullActionId, input.epochId, input.points, input.reason]
  );

  if (result.rows[0]) return { entry: mapRow(result.rows[0]), created: true };

  const existing = await db.query<PointsEntryRow>("SELECT * FROM points_ledger WHERE salvage_action_id = $1", [
    input.cullActionId,
  ]);
  return { entry: mapRow(existing.rows[0]), created: false };
}

export interface WalletStats {
  points: number;
  verifiedEvents: number;
  assetsCulld: number;
  actualRecoveryLamports: number;
}

export async function getWalletStats(db: Db, walletId: string): Promise<WalletStats> {
  const [pointsResult, assetsResult, eventsResult, recoveryResult] = await Promise.all([
    db.query<{ total: string | null }>("SELECT SUM(points) AS total FROM points_ledger WHERE wallet_id = $1", [walletId]),
    db.query<{ count: string }>("SELECT COUNT(*) AS count FROM salvage_actions WHERE wallet_id = $1 AND status = 'VERIFIED'", [
      walletId,
    ]),
    db.query<{ count: string }>(
      `SELECT COUNT(DISTINCT salvage_event_id) AS count FROM salvage_actions WHERE wallet_id = $1 AND status = 'VERIFIED'`,
      [walletId]
    ),
    db.query<{ total: string | null }>(
      "SELECT SUM(actual_recovery_lamports) AS total FROM salvage_actions WHERE wallet_id = $1 AND status = 'VERIFIED'",
      [walletId]
    ),
  ]);

  return {
    points: Number(pointsResult.rows[0]?.total ?? 0),
    assetsCulld: Number(assetsResult.rows[0]?.count ?? 0),
    verifiedEvents: Number(eventsResult.rows[0]?.count ?? 0),
    actualRecoveryLamports: Number(recoveryResult.rows[0]?.total ?? 0),
  };
}

export async function getWalletPointsForEpoch(db: Db, walletId: string, epochId: string): Promise<number> {
  const result = await db.query<{ total: string | null }>(
    `SELECT COALESCE((SELECT SUM(points) FROM points_ledger WHERE wallet_id = $1 AND epoch_id = $2), 0)
      + COALESCE((SELECT points FROM scan_allocations WHERE wallet_id = $1 AND epoch_id = $2), 0) AS total`,
    [walletId, epochId]
  );
  return Number(result.rows[0]?.total ?? 0);
}

export interface WalletEpochPoints {
  walletId: string;
  walletAddress: string;
  points: number;
}

/** Every wallet that earned at least one point in this epoch, with their
 * total — the real input to simulateEpochRewards() for a given epoch.
 * Wallets with zero points in this epoch are not included (they have
 * nothing to allocate; simulateEpochRewards treats an absent wallet the
 * same as a zero-point one). */
export async function listWalletPointsForEpoch(db: Db, epochId: string): Promise<WalletEpochPoints[]> {
  const result = await db.query<{ wallet_id: string; address: string; total: string }>(
    `SELECT wallet_id, address, SUM(points) AS total
     FROM (
       SELECT pl.wallet_id, w.address, pl.points
       FROM points_ledger pl JOIN wallets w ON w.id = pl.wallet_id
       WHERE pl.epoch_id = $1
       UNION ALL
       SELECT sa.wallet_id, w.address, sa.points
       FROM scan_allocations sa JOIN wallets w ON w.id = sa.wallet_id
       WHERE sa.epoch_id = $1
     ) combined
     GROUP BY wallet_id, address
     HAVING SUM(points) > 0`,
    [epochId]
  );
  return result.rows.map((row) => ({ walletId: row.wallet_id, walletAddress: row.address, points: Number(row.total) }));
}
