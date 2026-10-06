import "server-only";
import { Db } from "../db/types";

export type FeeEventDirection = "IN" | "OUT";

export interface FeeWalletEventRecord {
  id: string;
  direction: FeeEventDirection;
  asset: string;
  decimals: number;
  amount: number;
  source: string;
  transactionSignature: string;
  notes: string | null;
  createdAt: string;
}

interface FeeWalletEventRow {
  id: string;
  direction: FeeEventDirection;
  asset: string;
  decimals: number;
  amount: string | number;
  source: string;
  transaction_signature: string;
  notes: string | null;
  created_at: string;
}

function mapRow(row: FeeWalletEventRow): FeeWalletEventRecord {
  return {
    id: row.id,
    direction: row.direction,
    asset: row.asset,
    decimals: row.decimals,
    amount: Number(row.amount),
    source: row.source,
    transactionSignature: row.transaction_signature,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export class FeeWalletError extends Error {}

export interface RecordFeeEventInput {
  direction: FeeEventDirection;
  asset?: string;
  decimals?: number;
  amount: number;
  source: string;
  transactionSignature: string;
  notes?: string;
}

/**
 * Records one real, observed fee wallet inflow or outflow. This table is
 * CULLER's protocol revenue ledger — the CULLER FEE WALLET — and is
 * completely separate from the community reward vault
 * (reward_snapshots / reward_claims). Append-only and keyed by a unique
 * transaction signature, so replaying the same on-chain transaction
 * twice is a no-op rather than double-counting revenue.
 */
export async function recordFeeEvent(db: Db, input: RecordFeeEventInput): Promise<{ event: FeeWalletEventRecord; created: boolean }> {
  if (input.amount <= 0) {
    throw new FeeWalletError(`recordFeeEvent: amount must be > 0, got ${input.amount}.`);
  }
  const result = await db.query<FeeWalletEventRow>(
    `INSERT INTO fee_wallet_events (direction, asset, decimals, amount, source, transaction_signature, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (transaction_signature) DO NOTHING
     RETURNING *`,
    [input.direction, input.asset ?? "SOL", input.decimals ?? 9, input.amount, input.source, input.transactionSignature, input.notes ?? null]
  );
  if (result.rows[0]) return { event: mapRow(result.rows[0]), created: true };

  const existing = await db.query<FeeWalletEventRow>("SELECT * FROM fee_wallet_events WHERE transaction_signature = $1", [
    input.transactionSignature,
  ]);
  if (!existing.rows[0]) {
    throw new FeeWalletError("recordFeeEvent: conflict reported but no existing row found.");
  }
  return { event: mapRow(existing.rows[0]), created: false };
}

export interface FeeWalletStatus {
  asset: string;
  /** Total ever received (sum of IN events). */
  totalReceived: number;
  /** Total ever claimed/withdrawn (sum of OUT events) -- e.g. spent on a
   * buyback or moved to another treasury address. */
  claimed: number;
  /** Current balance available to claim: totalReceived - claimed. Never
   * negative in correct operation (an OUT event should never be
   * recorded for more than the current balance -- see
   * src/lib/culler/feeWallet.ts for the guard that enforces this before
   * calling recordFeeEvent with direction 'OUT'). */
  balance: number;
  events: FeeWalletEventRecord[];
}

/** Computes the fee wallet's status for one asset (default SOL) purely
 * from the append-only ledger -- there is no separately mutable balance
 * counter to drift out of sync. */
export async function getFeeWalletStatus(db: Db, asset = "SOL"): Promise<FeeWalletStatus> {
  const result = await db.query<FeeWalletEventRow>("SELECT * FROM fee_wallet_events WHERE asset = $1 ORDER BY created_at DESC", [asset]);
  const events = result.rows.map(mapRow);
  const totalReceived = events.filter((e) => e.direction === "IN").reduce((sum, e) => sum + e.amount, 0);
  const claimed = events.filter((e) => e.direction === "OUT").reduce((sum, e) => sum + e.amount, 0);
  return { asset, totalReceived, claimed, balance: totalReceived - claimed, events };
}
