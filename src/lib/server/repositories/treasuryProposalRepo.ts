import "server-only";
import { Db } from "../db/types";

export type TreasuryProposalType = "FUND_REWARD_VAULT" | "BURN" | "TRANSFER";

export interface TreasuryProposalRecord {
  id: string;
  proposalType: TreasuryProposalType;
  /** Integer $SALV base units (9 decimals), as a bigint. */
  amountBaseUnits: bigint;
  destinationAddress: string;
  memo: string | null;
  /** The built, unsigned transaction, base64-encoded, if one was
   * constructed (see src/lib/solana/salv/treasuryProposals.ts). May be
   * null for a proposal recorded purely as a planning/audit record. */
  unsignedTransactionBase64: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface TreasuryProposalRow {
  id: string;
  proposal_type: TreasuryProposalType;
  amount_base_units: string | number;
  destination_address: string;
  memo: string | null;
  unsigned_transaction_base64: string | null;
  created_by: string | null;
  created_at: string;
}

function parseBaseUnits(raw: string | number): bigint {
  const text = String(raw);
  const whole = text.includes(".") ? text.slice(0, text.indexOf(".")) : text;
  return BigInt(whole);
}

function mapRow(row: TreasuryProposalRow): TreasuryProposalRecord {
  return {
    id: row.id,
    proposalType: row.proposal_type,
    amountBaseUnits: parseBaseUnits(row.amount_base_units),
    destinationAddress: row.destination_address,
    memo: row.memo,
    unsignedTransactionBase64: row.unsigned_transaction_base64,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export class TreasuryProposalError extends Error {}

export interface RecordTreasuryProposalInput {
  proposalType: TreasuryProposalType;
  amountBaseUnits: bigint;
  destinationAddress: string;
  memo?: string;
  unsignedTransactionBase64?: string;
  createdBy?: string;
}

/**
 * Records that an unsigned treasury proposal was BUILT -- never that it
 * was executed. There is no status column and no function anywhere in
 * this codebase that could mark a row here "EXECUTED", because nothing
 * in this codebase ever submits a treasury transaction: a real transfer,
 * burn, or funding movement requires the 3-of-3 multisig members to
 * independently sign and submit it themselves, out-of-band, using the
 * unsigned transaction this function's caller constructed (see
 * src/lib/solana/salv/treasuryProposals.ts). This table exists purely
 * as a durable, append-only audit trail of "what was proposed, when, by
 * what admin action" -- the same "proposal creation does not equal
 * execution" guarantee the Phase 6 test matrix requires is true by
 * construction here, not by a status flag that a bug could set wrong.
 */
export async function recordTreasuryProposal(db: Db, input: RecordTreasuryProposalInput): Promise<TreasuryProposalRecord> {
  if (input.amountBaseUnits <= 0n) {
    throw new TreasuryProposalError(`recordTreasuryProposal: amountBaseUnits must be > 0, got ${input.amountBaseUnits}.`);
  }
  if (!input.destinationAddress.trim()) {
    throw new TreasuryProposalError("recordTreasuryProposal: destinationAddress is required.");
  }
  const result = await db.query<TreasuryProposalRow>(
    `INSERT INTO treasury_proposals (proposal_type, amount_base_units, destination_address, memo, unsigned_transaction_base64, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.proposalType,
      input.amountBaseUnits.toString(),
      input.destinationAddress,
      input.memo ?? null,
      input.unsignedTransactionBase64 ?? null,
      input.createdBy ?? null,
    ]
  );
  return mapRow(result.rows[0]);
}

export async function listTreasuryProposals(db: Db): Promise<TreasuryProposalRecord[]> {
  const result = await db.query<TreasuryProposalRow>("SELECT * FROM treasury_proposals ORDER BY created_at DESC");
  return result.rows.map(mapRow);
}
