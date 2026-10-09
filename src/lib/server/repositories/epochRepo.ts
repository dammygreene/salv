import "server-only";
import { Db } from "../db/types";
import { AllocationPolicy, DEFAULT_ALLOCATION_POLICY } from "../../cull/allocationPolicy";

export type EpochStatus = "UPCOMING" | "ACTIVE" | "CLOSED";

export interface EpochRecord {
  id: string;
  number: number;
  startsAt: string;
  endsAt: string;
  rewardPoolPoints: number;
  status: EpochStatus;
  createdAt: string;
  allocationPolicy: AllocationPolicy;
  conversionRate: bigint | null;
}

interface EpochRow {
  id: string;
  number: number;
  starts_at: string;
  ends_at: string;
  reward_pool_points: string | number;
  status: EpochStatus;
  created_at: string;
  allocation_policy: AllocationPolicy | null;
  culler_tokens_per_point: string | number | null;
}

function mapRow(row: EpochRow): EpochRecord {
  return {
    id: row.id,
    number: row.number,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    rewardPoolPoints: Number(row.reward_pool_points),
    status: row.status,
    createdAt: row.created_at,
    allocationPolicy: row.allocation_policy ?? DEFAULT_ALLOCATION_POLICY,
    conversionRate: row.culler_tokens_per_point === null ? null : BigInt(String(row.culler_tokens_per_point)),
  };
}

export class EpochError extends Error {}

/** The database's partial unique index on (status) WHERE status='ACTIVE'
 * is the real guarantee here; this is just a convenience read. */
export async function getActiveEpoch(db: Db): Promise<EpochRecord | null> {
  const result = await db.query<EpochRow>("SELECT * FROM epochs WHERE status = 'ACTIVE'");
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function listEpochs(db: Db): Promise<EpochRecord[]> {
  const result = await db.query<EpochRow>("SELECT * FROM epochs ORDER BY number DESC");
  return result.rows.map(mapRow);
}

export async function getEpochByNumber(db: Db, number: number): Promise<EpochRecord | null> {
  const result = await db.query<EpochRow>("SELECT * FROM epochs WHERE number = $1", [number]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function createEpoch(
  db: Db,
  input: { number: number; startsAt: string; endsAt: string; rewardPoolPoints: number; allocationPolicy?: AllocationPolicy; conversionRate?: bigint | number }
): Promise<EpochRecord> {
  if (input.conversionRate !== undefined && (BigInt(input.conversionRate) <= 0n)) {
    throw new EpochError("conversionRate must be a positive integer.");
  }
  const result = await db.query<EpochRow>(
    `INSERT INTO epochs (number, starts_at, ends_at, reward_pool_points, allocation_policy, culler_tokens_per_point, status)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'UPCOMING') RETURNING *`,
    [input.number, input.startsAt, input.endsAt, input.rewardPoolPoints, JSON.stringify(input.allocationPolicy ?? DEFAULT_ALLOCATION_POLICY), input.conversionRate === undefined ? null : String(input.conversionRate)]
  );
  return mapRow(result.rows[0]);
}

/** Activates an UPCOMING epoch, closing whatever is currently ACTIVE
 * first, all inside one transaction. Throws if the target epoch is not
 * in UPCOMING status (e.g. already closed, or already active). */
export async function activateEpoch(db: Db, epochId: string): Promise<EpochRecord> {
  return db.transaction(async (tx) => {
    await tx.query("UPDATE epochs SET status = 'CLOSED' WHERE status = 'ACTIVE'");
    const result = await tx.query<EpochRow>(
      "UPDATE epochs SET status = 'ACTIVE' WHERE id = $1 AND status = 'UPCOMING' RETURNING *",
      [epochId]
    );
    if (!result.rows[0]) {
      throw new EpochError("Epoch is not in UPCOMING status, or does not exist.");
    }
    return mapRow(result.rows[0]);
  });
}

/** Total points awarded network-wide within one epoch. This is retained for
 * legacy proportional epochs and reporting; fixed epochs never use it to
 * calculate an individual allocation. */
export async function getEpochTotalPointsAwarded(db: Db, epochId: string): Promise<number> {
  const result = await db.query<{ total: string | null }>(
    `SELECT SUM(points) AS total
     FROM (
       SELECT points FROM points_ledger WHERE epoch_id = $1
       UNION ALL
       SELECT points FROM scan_allocations WHERE epoch_id = $1
     ) combined`,
    [epochId]
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function closeEpoch(db: Db, epochId: string): Promise<EpochRecord> {
  const result = await db.query<EpochRow>("UPDATE epochs SET status = 'CLOSED' WHERE id = $1 AND status = 'ACTIVE' RETURNING *", [
    epochId,
  ]);
  if (!result.rows[0]) {
    throw new EpochError("Epoch is not currently ACTIVE, or does not exist.");
  }
  return mapRow(result.rows[0]);
}
