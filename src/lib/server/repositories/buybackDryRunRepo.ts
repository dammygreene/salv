import "server-only";
import { Db } from "../db/types";

export interface BuybackDryRunRecord {
  id: string;
  feeBalance: number;
  feeAsset: string;
  currentCullerQuote: number;
  maxSpend: number;
  minOutput: number;
  slippageLimitBps: number;
  plannedSpend: number;
  expectedCullerOutput: number;
  rejected: boolean;
  rejectionReason: string | null;
  createdAt: string;
}

interface BuybackDryRunRow {
  id: string;
  fee_balance: string | number;
  fee_asset: string;
  current_salv_quote: string | number;
  max_spend: string | number;
  min_output: string | number;
  slippage_limit_bps: number;
  planned_spend: string | number;
  expected_salv_output: string | number;
  rejected: boolean;
  rejection_reason: string | null;
  created_at: string;
}

function mapRow(row: BuybackDryRunRow): BuybackDryRunRecord {
  return {
    id: row.id,
    feeBalance: Number(row.fee_balance),
    feeAsset: row.fee_asset,
    currentCullerQuote: Number(row.current_salv_quote),
    maxSpend: Number(row.max_spend),
    minOutput: Number(row.min_output),
    slippageLimitBps: row.slippage_limit_bps,
    plannedSpend: Number(row.planned_spend),
    expectedCullerOutput: Number(row.expected_salv_output),
    rejected: row.rejected,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  };
}

export interface RecordBuybackDryRunInput {
  feeBalance: number;
  feeAsset: string;
  currentCullerQuote: number;
  maxSpend: number;
  minOutput: number;
  slippageLimitBps: number;
  plannedSpend: number;
  expectedCullerOutput: number;
  rejected: boolean;
  rejectionReason?: string | null;
}

/** Records one dry-run buyback plan. Append-only — a dry run is always a
 * historical log entry, never something that gets executed or edited
 * later. No real swap ever happens as a result of this table existing. */
export async function recordBuybackDryRun(db: Db, input: RecordBuybackDryRunInput): Promise<BuybackDryRunRecord> {
  const result = await db.query<BuybackDryRunRow>(
    `INSERT INTO buyback_dry_runs
       (fee_balance, fee_asset, current_salv_quote, max_spend, min_output, slippage_limit_bps, planned_spend, expected_salv_output, rejected, rejection_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      input.feeBalance,
      input.feeAsset,
      input.currentCullerQuote,
      input.maxSpend,
      input.minOutput,
      input.slippageLimitBps,
      input.plannedSpend,
      input.expectedCullerOutput,
      input.rejected,
      input.rejectionReason ?? null,
    ]
  );
  return mapRow(result.rows[0]);
}

export async function listBuybackDryRuns(db: Db, limit = 50): Promise<BuybackDryRunRecord[]> {
  const result = await db.query<BuybackDryRunRow>("SELECT * FROM buyback_dry_runs ORDER BY created_at DESC LIMIT $1", [limit]);
  return result.rows.map(mapRow);
}
