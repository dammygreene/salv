import "server-only";
import { Db } from "../db/types";
import { baseUnitsToCullerDecimalString } from "../../culler/tokenSpec";

/** `NOT_APPLICABLE` existed in Phase 7 for a standalone EVM-only row; it
 * no longer applies now that every row's identity is always a Solana
 * wallet (Phase 8 forbids "Robinhood only" submissions entirely), so a
 * row's reward status always flows from its Solana wallet's own claim
 * view. */
export type RewardLedgerStatus = "NO_EPOCH" | "NO_SNAPSHOT" | "ALLOCATED" | "CLAIMED" | "FAILED";

export interface RewardLedgerEntry {
  id: string;
  /** The sole reward identity. Always a validated Solana address. */
  solanaWallet: string;
  /** Optional linked Robinhood/EVM address for this same submission, or
   * `null` if none is currently linked. Metadata only -- never part of
   * this row's identity, never a second reward. */
  robinhoodWallet: string | null;
  epochNumber: number | null;
  cullerAllocatedBaseUnits: bigint;
  status: RewardLedgerStatus;
  lastScanId: string;
  firstScannedAt: string;
  scannedAt: string;
}

interface RewardLedgerRow {
  id: string;
  solana_wallet: string;
  robinhood_wallet: string | null;
  epoch_number: number | null;
  salv_allocated_base_units: string | number;
  status: RewardLedgerStatus;
  last_scan_id: string;
  first_scanned_at: string | Date;
  scanned_at: string | Date;
}

function parseBaseUnits(raw: string | number): bigint {
  const text = String(raw);
  const whole = text.includes(".") ? text.slice(0, text.indexOf(".")) : text;
  return BigInt(whole);
}

/** Both the `pg` driver (production Postgres) and PGlite (tests) parse
 * `timestamptz` columns into native JS `Date` objects, not strings,
 * despite the `Db` interface's row types claiming `string` -- so this
 * always normalizes through `new Date(...).toISOString()` rather than
 * trusting the raw value's shape. This is what guarantees the CSV
 * export's `scanned_at` column is always real ISO-8601
 * (`2026-10-06T03:12:42.000Z`), never a Date's locale-dependent
 * `toString()` output. */
function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

function mapRow(row: RewardLedgerRow): RewardLedgerEntry {
  return {
    id: row.id,
    solanaWallet: row.solana_wallet,
    robinhoodWallet: row.robinhood_wallet,
    epochNumber: row.epoch_number,
    cullerAllocatedBaseUnits: parseBaseUnits(row.salv_allocated_base_units),
    status: row.status,
    lastScanId: row.last_scan_id,
    firstScannedAt: toIso(row.first_scanned_at),
    scannedAt: toIso(row.scanned_at),
  };
}

export class RewardLedgerError extends Error {}

/** Stable, never-null dedup key: the epoch's own number when one exists,
 * or a fixed sentinel when it doesn't. See migration 0005/0006's comments
 * for why this must never be a bare NULL. */
function epochKeyFor(epochNumber: number | null): string {
  return epochNumber === null ? "NO_EPOCH" : String(epochNumber);
}

export interface UpsertRewardLedgerEntryInput {
  solanaWallet: string;
  /** `null` means this particular scan did not include a Robinhood
   * address. See the replacement-policy note on `upsertRewardLedgerEntry`
   * below for what that does to an already-linked address. */
  robinhoodWallet: string | null;
  epochNumber: number | null;
  cullerAllocatedBaseUnits: bigint;
  status: RewardLedgerStatus;
  scanId: string;
}

/**
 * Inserts or updates exactly one row for (solanaWallet, epoch) — the
 * reward identity is the Solana wallet alone; a linked Robinhood address
 * is metadata on that same row, never a second identity and never a
 * second allocation. Implemented as a single atomic
 * `INSERT ... ON CONFLICT ... DO UPDATE`, which Postgres (and PGlite, the
 * same engine used in tests) resolves with a per-row lock: two
 * concurrent upserts for the SAME (solanaWallet, epoch) key serialize
 * safely (one applies, then the other applies on top — no lost update,
 * no duplicate row), while upserts for DIFFERENT Solana wallets never
 * contend with each other at all.
 *
 * **Robinhood replacement policy** (documented here and in
 * docs/culler-reward-ledger.md): every upsert sets `robinhood_wallet` to
 * exactly what THIS scan submitted — a new address replaces whatever was
 * linked before, and submitting with no Robinhood address this time
 * clears any previously linked one. The row always reflects the most
 * recently submitted state for this Solana wallet + epoch, never an
 * additive merge of every Robinhood address ever seen for it. This is
 * the deterministic policy required when the same Solana wallet is
 * rescanned with a different (or absent) Robinhood address in the same
 * epoch — there is never more than one linked Robinhood address per row
 * at a time, and the Solana wallet + epoch identity itself never changes
 * because of it.
 *
 * Never computes or guesses `cullerAllocatedBaseUnits`/`status` itself —
 * both must already have been derived from the authoritative reward
 * snapshot/claim system (src/lib/culler/claims.ts's `getClaimView`), keyed
 * strictly on the Solana wallet — by the caller. This function's only
 * job is to durably record that already-computed value, exactly once
 * per (solanaWallet, epoch).
 */
export async function upsertRewardLedgerEntry(db: Db, input: UpsertRewardLedgerEntryInput): Promise<RewardLedgerEntry> {
  if (input.cullerAllocatedBaseUnits < 0n) {
    throw new RewardLedgerError(`upsertRewardLedgerEntry: cullerAllocatedBaseUnits must be >= 0, got ${input.cullerAllocatedBaseUnits}.`);
  }
  if (!input.solanaWallet.trim()) {
    throw new RewardLedgerError("upsertRewardLedgerEntry: solanaWallet is required.");
  }

  const epochKey = epochKeyFor(input.epochNumber);
  const result = await db.query<RewardLedgerRow>(
    `INSERT INTO reward_ledger_entries
       (solana_wallet, robinhood_wallet, epoch_number, epoch_key, salv_allocated_base_units, status, last_scan_id, first_scanned_at, scanned_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
     ON CONFLICT (solana_wallet, epoch_key) DO UPDATE SET
       robinhood_wallet = EXCLUDED.robinhood_wallet,
       salv_allocated_base_units = EXCLUDED.salv_allocated_base_units,
       status = EXCLUDED.status,
       last_scan_id = EXCLUDED.last_scan_id,
       scanned_at = now()
     RETURNING *`,
    [input.solanaWallet, input.robinhoodWallet, input.epochNumber, epochKey, input.cullerAllocatedBaseUnits.toString(), input.status, input.scanId]
  );
  if (!result.rows[0]) {
    throw new RewardLedgerError("upsertRewardLedgerEntry: INSERT ... ON CONFLICT did not return a row.");
  }
  return mapRow(result.rows[0]);
}

export async function listRewardLedgerEntries(db: Db): Promise<RewardLedgerEntry[]> {
  const result = await db.query<RewardLedgerRow>("SELECT * FROM reward_ledger_entries ORDER BY scanned_at DESC");
  return result.rows.map(mapRow);
}

export async function getRewardLedgerEntry(db: Db, solanaWallet: string, epochNumber: number | null): Promise<RewardLedgerEntry | null> {
  const result = await db.query<RewardLedgerRow>("SELECT * FROM reward_ledger_entries WHERE solana_wallet = $1 AND epoch_key = $2", [
    solanaWallet,
    epochKeyFor(epochNumber),
  ]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

const CSV_HEADER = "solana_wallet,robinhood_wallet,epoch_id,culler_allocated,scanned_at,status";

/** Escapes a single CSV field per RFC 4180: wraps in quotes and doubles
 * any embedded quote whenever the field contains a comma, quote, or
 * newline. None of this codebase's own values need it today (wallet
 * addresses and status enums never contain a comma), but this keeps the
 * export correct even if an operator later pastes something unusual. */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serializes the full reward ledger to CSV text — human-readable, one
 * row per (Solana wallet, epoch), most-recently-scanned first. Column
 * order is `solana_wallet,robinhood_wallet,epoch_id,culler_allocated,
 * scanned_at,status`. `robinhood_wallet` is an empty field when no
 * address is currently linked — never a placeholder string.
 *
 * This is the ONLY place CSV text is ever produced; the table itself is
 * the durable, race-safe source of truth (see upsertRewardLedgerEntry's
 * own comment), and this function never does anything other than format
 * already-stored rows. $CULLER amounts use the same deterministic,
 * bigint-based decimal string as the rest of this codebase's precision-
 * sensitive paths (src/lib/culler/tokenSpec.ts's `baseUnitsToCullerDecimalString`)
 * — never a floating-point `toFixed()`/`toLocaleString()`.
 */
export function serializeRewardLedgerToCsv(entries: RewardLedgerEntry[]): string {
  const lines = [CSV_HEADER];
  for (const entry of entries) {
    lines.push(
      [
        csvField(entry.solanaWallet),
        csvField(entry.robinhoodWallet ?? ""),
        csvField(entry.epochNumber === null ? "" : String(entry.epochNumber)),
        csvField(baseUnitsToCullerDecimalString(entry.cullerAllocatedBaseUnits)),
        csvField(entry.scannedAt),
        csvField(entry.status),
      ].join(",")
    );
  }
  // CSV conventionally ends with a trailing newline.
  return lines.join("\n") + "\n";
}
