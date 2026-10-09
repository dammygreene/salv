import "server-only";
import type { Db } from "../db/types";

export async function upsertScanAllocation(
  db: Db,
  input: { walletId: string; epochId: string; points: number; evidence: unknown; cullerAllocatedBaseUnits?: bigint; conversionRate?: bigint; allocationPolicyVersion?: string }
): Promise<void> {
  await db.query(
    `INSERT INTO scan_allocations (wallet_id, epoch_id, points, evidence, culler_allocated_base_units, conversion_rate, allocation_policy_version)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
     ON CONFLICT (wallet_id, epoch_id) DO UPDATE SET
       points = EXCLUDED.points, evidence = EXCLUDED.evidence,
       culler_allocated_base_units = EXCLUDED.culler_allocated_base_units,
       conversion_rate = EXCLUDED.conversion_rate,
       allocation_policy_version = EXCLUDED.allocation_policy_version,
       updated_at = now()`,
    [input.walletId, input.epochId, input.points, JSON.stringify(input.evidence), input.cullerAllocatedBaseUnits?.toString() ?? "0", input.conversionRate?.toString() ?? null, input.allocationPolicyVersion ?? "v1"]
  );
}

export async function getScanAllocationPoints(db: Db, walletId: string, epochId: string): Promise<number> {
  const result = await db.query<{ points: number }>(
    "SELECT points FROM scan_allocations WHERE wallet_id = $1 AND epoch_id = $2",
    [walletId, epochId]
  );
  return Number(result.rows[0]?.points ?? 0);
}
