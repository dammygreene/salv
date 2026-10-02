import "server-only";
import { SalvageActionType } from "@/lib/salvage/registry";
import { SalvageEventStatus } from "@/lib/types";
import { Db } from "../db/types";

export interface SalvageEventRecord {
  id: string;
  walletId: string;
  signature: string;
  slot: number | null;
  status: SalvageEventStatus;
  createdAt: string;
  verifiedAt: string | null;
}

interface SalvageEventRow {
  id: string;
  wallet_id: string;
  transaction_signature: string;
  slot: string | number | null;
  status: SalvageEventStatus;
  created_at: string;
  verified_at: string | null;
}

function mapEventRow(row: SalvageEventRow): SalvageEventRecord {
  return {
    id: row.id,
    walletId: row.wallet_id,
    signature: row.transaction_signature,
    slot: row.slot === null ? null : Number(row.slot),
    status: row.status,
    createdAt: row.created_at,
    verifiedAt: row.verified_at,
  };
}

/** One row per (chain, transaction_signature) — the transaction-level
 * record. Idempotent: calling this again for the same signature never
 * creates a second row. */
export async function ensureSalvageEvent(
  db: Db,
  input: { walletId: string; signature: string; chain?: string }
): Promise<SalvageEventRecord> {
  const chain = input.chain ?? "solana";
  const result = await db.query<SalvageEventRow>(
    `INSERT INTO salvage_events (wallet_id, chain, transaction_signature)
     VALUES ($1, $2, $3)
     ON CONFLICT (chain, transaction_signature) DO UPDATE SET chain = EXCLUDED.chain
     RETURNING id, wallet_id, transaction_signature, slot, status, created_at, verified_at`,
    [input.walletId, chain, input.signature]
  );
  return mapEventRow(result.rows[0]);
}

export async function setSalvageEventStatus(
  db: Db,
  eventId: string,
  status: SalvageEventStatus,
  slot: number | null
): Promise<void> {
  await db.query(
    `UPDATE salvage_events
     SET status = $2, slot = COALESCE($3, slot), verified_at = CASE WHEN $2 = 'VERIFIED' THEN now() ELSE verified_at END
     WHERE id = $1`,
    [eventId, status, slot]
  );
}

export interface SalvageActionRecord {
  id: string;
  salvageEventId: string;
  walletId: string;
  assetId: string | null;
  tokenAccount: string;
  programId: string | null;
  mint: string | null;
  classification: string | null;
  action: SalvageActionType;
  idempotencyKey: string;
  expectedRecoveryLamports: number;
  actualRecoveryLamports: number | null;
  status: SalvageEventStatus;
  reason: string | null;
  points: number;
  createdAt: string;
  verifiedAt: string | null;
}

interface SalvageActionRow {
  id: string;
  salvage_event_id: string;
  wallet_id: string;
  asset_id: string | null;
  token_account: string;
  program_id: string | null;
  mint: string | null;
  classification: string | null;
  action: SalvageActionType;
  idempotency_key: string;
  expected_recovery_lamports: string | number;
  actual_recovery_lamports: string | number | null;
  status: SalvageEventStatus;
  reason: string | null;
  points: number;
  created_at: string;
  verified_at: string | null;
}

function mapActionRow(row: SalvageActionRow): SalvageActionRecord {
  return {
    id: row.id,
    salvageEventId: row.salvage_event_id,
    walletId: row.wallet_id,
    assetId: row.asset_id,
    tokenAccount: row.token_account,
    programId: row.program_id,
    mint: row.mint,
    classification: row.classification,
    action: row.action,
    idempotencyKey: row.idempotency_key,
    expectedRecoveryLamports: Number(row.expected_recovery_lamports),
    actualRecoveryLamports: row.actual_recovery_lamports === null ? null : Number(row.actual_recovery_lamports),
    status: row.status,
    reason: row.reason,
    points: row.points,
    createdAt: row.created_at,
    verifiedAt: row.verified_at,
  };
}

export async function findActionByIdempotencyKey(db: Db, key: string): Promise<SalvageActionRecord | null> {
  const result = await db.query<SalvageActionRow>("SELECT * FROM salvage_actions WHERE idempotency_key = $1", [key]);
  return result.rows[0] ? mapActionRow(result.rows[0]) : null;
}

/** The core anti-farming lookup: has THIS wallet ever recorded THIS
 * action for THIS token account before, under any transaction signature?
 * Backed by the `salvage_actions` (wallet_id, token_account, action)
 * unique constraint — this query and that constraint must never
 * disagree, since callers use this to decide whether to insert at all. */
export async function findActionByWalletTokenAccountAction(
  db: Db,
  walletId: string,
  tokenAccount: string,
  action: SalvageActionType
): Promise<SalvageActionRecord | null> {
  const result = await db.query<SalvageActionRow>(
    "SELECT * FROM salvage_actions WHERE wallet_id = $1 AND token_account = $2 AND action = $3",
    [walletId, tokenAccount, action]
  );
  return result.rows[0] ? mapActionRow(result.rows[0]) : null;
}

/** How many DISTINCT wallets have recorded a VERIFIED action for this
 * mint since `sinceIso`. Used as a soft anti-farming heuristic — see
 * server/antifarm/checks.ts. */
export async function countDistinctWalletsForMintAction(
  db: Db,
  mint: string,
  action: SalvageActionType,
  sinceIso: string
): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(DISTINCT wallet_id) AS count FROM salvage_actions
     WHERE mint = $1 AND action = $2 AND status = 'VERIFIED' AND created_at >= $3`,
    [mint, action, sinceIso]
  );
  return Number(result.rows[0]?.count ?? 0);
}

export interface InsertSalvageActionInput {
  salvageEventId: string;
  walletId: string;
  assetId: string | null;
  tokenAccount: string;
  programId: string | null;
  mint: string | null;
  classification: string | null;
  action: SalvageActionType;
  idempotencyKey: string;
  expectedRecoveryLamports: number;
  actualRecoveryLamports: number | null;
  status: SalvageEventStatus;
  reason: string | null;
  points: number;
}

/** Inserts a new salvage_action row. Relies on two unique constraints as
 * the real source of truth for "never duplicate": idempotency_key (same
 * transaction + action + account) and (wallet_id, token_account, action)
 * (same wallet repeating the same action on the same account under a
 * different signature). Callers are expected to have already checked
 * both via the lookup functions above before calling this — this
 * function's ON CONFLICT DO NOTHING is the last-resort guarantee against
 * a race between two concurrent requests, not the primary check. */
export async function insertSalvageAction(
  db: Db,
  input: InsertSalvageActionInput
): Promise<{ action: SalvageActionRecord; created: boolean }> {
  const result = await db.query<SalvageActionRow>(
    `INSERT INTO salvage_actions (
       salvage_event_id, wallet_id, asset_id, token_account, program_id, mint,
       classification, action, idempotency_key, expected_recovery_lamports,
       actual_recovery_lamports, status, reason, points, verified_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, CASE WHEN $12 = 'VERIFIED' THEN now() ELSE NULL END)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING *`,
    [
      input.salvageEventId,
      input.walletId,
      input.assetId,
      input.tokenAccount,
      input.programId,
      input.mint,
      input.classification,
      input.action,
      input.idempotencyKey,
      input.expectedRecoveryLamports,
      input.actualRecoveryLamports,
      input.status,
      input.reason,
      input.points,
    ]
  );

  if (result.rows[0]) {
    return { action: mapActionRow(result.rows[0]), created: true };
  }

  const existing = await findActionByIdempotencyKey(db, input.idempotencyKey);
  if (!existing) {
    throw new Error("insertSalvageAction: conflict reported but no existing row found.");
  }
  return { action: existing, created: false };
}

export interface SalvageActionWithSignature extends SalvageActionRecord {
  signature: string;
}

interface SalvageActionWithSignatureRow extends SalvageActionRow {
  transaction_signature: string;
}

export async function listVerifiedActionsForWallet(
  db: Db,
  walletId: string,
  limit: number,
  offset: number
): Promise<{ actions: SalvageActionWithSignature[]; total: number }> {
  const [rows, count] = await Promise.all([
    db.query<SalvageActionWithSignatureRow>(
      `SELECT sa.*, se.transaction_signature
       FROM salvage_actions sa
       JOIN salvage_events se ON se.id = sa.salvage_event_id
       WHERE sa.wallet_id = $1 AND sa.status = 'VERIFIED'
       ORDER BY sa.created_at DESC LIMIT $2 OFFSET $3`,
      [walletId, limit, offset]
    ),
    db.query<{ count: string }>("SELECT COUNT(*) AS count FROM salvage_actions WHERE wallet_id = $1 AND status = 'VERIFIED'", [
      walletId,
    ]),
  ]);
  return {
    actions: rows.rows.map((row) => ({ ...mapActionRow(row), signature: row.transaction_signature })),
    total: Number(count.rows[0]?.count ?? 0),
  };
}

export async function listActionsForWallet(db: Db, walletId: string): Promise<SalvageActionRecord[]> {
  const result = await db.query<SalvageActionRow>("SELECT * FROM salvage_actions WHERE wallet_id = $1 ORDER BY created_at DESC", [
    walletId,
  ]);
  return result.rows.map(mapActionRow);
}
