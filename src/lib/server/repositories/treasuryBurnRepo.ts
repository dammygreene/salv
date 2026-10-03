import "server-only";
import { Db } from "../db/types";

export interface TreasuryBurnRecord {
  id: string;
  /** Integer $SALV base units (9 decimals), as a bigint -- same
   * convention as reward_claims.amount_base_units (see
   * src/lib/server/repositories/rewardClaimRepo.ts). */
  amountBaseUnits: bigint;
  reason: string;
  transactionSignature: string;
  notes: string | null;
  createdAt: string;
}

interface TreasuryBurnRow {
  id: string;
  amount_base_units: string | number;
  reason: string;
  transaction_signature: string;
  notes: string | null;
  created_at: string;
}

function parseBaseUnits(raw: string | number): bigint {
  const text = String(raw);
  const whole = text.includes(".") ? text.slice(0, text.indexOf(".")) : text;
  return BigInt(whole);
}

function mapRow(row: TreasuryBurnRow): TreasuryBurnRecord {
  return {
    id: row.id,
    amountBaseUnits: parseBaseUnits(row.amount_base_units),
    reason: row.reason,
    transactionSignature: row.transaction_signature,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export class TreasuryBurnError extends Error {}

export interface RecordTreasuryBurnInput {
  amountBaseUnits: bigint;
  reason: string;
  transactionSignature: string;
  notes?: string;
}

/**
 * Records one real, CONFIRMED on-chain burn of $SALV from the community
 * treasury. This function does not burn anything itself -- it has no
 * network access and no signing key -- it only records a burn that a
 * human already executed via the 3-of-3 treasury multisig (Phase 6: "do
 * not add an automatic burn mechanism; any actual treasury movement
 * must require multisig approval"). `transactionSignature` must be the
 * real signature of that already-confirmed burn transaction.
 *
 * Append-only and idempotent on `transactionSignature`: recording the
 * same real burn transaction twice (e.g. a retried request) is a no-op,
 * never double-counted -- this is the same idempotency convention as
 * `src/lib/server/repositories/feeWalletRepo.ts`'s `recordFeeEvent`.
 */
export async function recordTreasuryBurn(db: Db, input: RecordTreasuryBurnInput): Promise<{ burn: TreasuryBurnRecord; created: boolean }> {
  if (input.amountBaseUnits <= 0n) {
    throw new TreasuryBurnError(`recordTreasuryBurn: amountBaseUnits must be > 0, got ${input.amountBaseUnits}.`);
  }
  if (!input.reason.trim()) {
    throw new TreasuryBurnError("recordTreasuryBurn: reason is required (never record a burn with no documented reason).");
  }
  const result = await db.query<TreasuryBurnRow>(
    `INSERT INTO treasury_burns (amount_base_units, reason, transaction_signature, notes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (transaction_signature) DO NOTHING
     RETURNING *`,
    [input.amountBaseUnits.toString(), input.reason, input.transactionSignature, input.notes ?? null]
  );
  if (result.rows[0]) return { burn: mapRow(result.rows[0]), created: true };

  const existing = await db.query<TreasuryBurnRow>("SELECT * FROM treasury_burns WHERE transaction_signature = $1", [input.transactionSignature]);
  if (!existing.rows[0]) {
    throw new TreasuryBurnError("recordTreasuryBurn: conflict reported but no existing row found.");
  }
  return { burn: mapRow(existing.rows[0]), created: false };
}

export async function listTreasuryBurns(db: Db): Promise<TreasuryBurnRecord[]> {
  const result = await db.query<TreasuryBurnRow>("SELECT * FROM treasury_burns ORDER BY created_at DESC");
  return result.rows.map(mapRow);
}

/** Sum of every recorded burn, ever. Purely derived from the append-only
 * ledger -- never a separately mutable counter. */
export async function sumBurnedBaseUnits(db: Db): Promise<bigint> {
  const result = await db.query<{ total: string | null }>("SELECT SUM(amount_base_units) AS total FROM treasury_burns");
  return result.rows[0]?.total ? parseBaseUnits(result.rows[0].total) : 0n;
}
