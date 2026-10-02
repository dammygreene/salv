import "server-only";
import { Db } from "../db/types";

export interface PointsEntryRecord {
  id: string;
  walletId: string;
  salvageActionId: string;
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
    salvageActionId: row.salvage_action_id,
    epochId: row.epoch_id,
    points: row.points,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

/**
 * Appends a points entry. Every point in this system traces back to
 * exactly one VERIFIED salvage_action via the UNIQUE(salvage_action_id)
 * constraint — this function is idempotent on that id: calling it twice
 * for the same action never double-counts.
 */
export async function awardPoints(
  db: Db,
  input: { walletId: string; salvageActionId: string; points: number; reason: string; epochId: string | null }
): Promise<{ entry: PointsEntryRecord; created: boolean }> {
  const result = await db.query<PointsEntryRow>(
    `INSERT INTO points_ledger (wallet_id, salvage_action_id, epoch_id, points, reason)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (salvage_action_id) DO NOTHING
     RETURNING *`,
    [input.walletId, input.salvageActionId, input.epochId, input.points, input.reason]
  );

  if (result.rows[0]) return { entry: mapRow(result.rows[0]), created: true };

  const existing = await db.query<PointsEntryRow>("SELECT * FROM points_ledger WHERE salvage_action_id = $1", [
    input.salvageActionId,
  ]);
  return { entry: mapRow(existing.rows[0]), created: false };
}

export interface WalletStats {
  points: number;
  verifiedEvents: number;
  assetsSalvaged: number;
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
    assetsSalvaged: Number(assetsResult.rows[0]?.count ?? 0),
    verifiedEvents: Number(eventsResult.rows[0]?.count ?? 0),
    actualRecoveryLamports: Number(recoveryResult.rows[0]?.total ?? 0),
  };
}

export async function getWalletPointsForEpoch(db: Db, walletId: string, epochId: string): Promise<number> {
  const result = await db.query<{ total: string | null }>(
    "SELECT SUM(points) AS total FROM points_ledger WHERE wallet_id = $1 AND epoch_id = $2",
    [walletId, epochId]
  );
  return Number(result.rows[0]?.total ?? 0);
}
