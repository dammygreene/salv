import "server-only";
import { Db } from "../db/types";
import { baseUnitsToSalvDecimalString } from "../../salv/tokenSpec";
import { WalletNetwork } from "../../walletAddress";

export type RewardLedgerStatus = "NOT_APPLICABLE" | "NO_EPOCH" | "NO_SNAPSHOT" | "ALLOCATED" | "CLAIMED" | "FAILED";

export interface RewardLedgerEntry {
  id: string;
  walletAddress: string;
  network: WalletNetwork;
  epochNumber: number | null;
  salvAllocatedBaseUnits: bigint;
  status: RewardLedgerStatus;
  lastScanId: string;
  firstScannedAt: string;
  scannedAt: string;
}

interface RewardLedgerRow {
  id: string;
  wallet_address: string;
  network: WalletNetwork;
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
    walletAddress: row.wallet_address,
    network: row.network,
    epochNumber: row.epoch_number,
    salvAllocatedBaseUnits: parseBaseUnits(row.salv_allocated_base_units),
    status: row.status,
    lastScanId: row.last_scan_id,
    firstScannedAt: toIso(row.first_scanned_at),
    scannedAt: toIso(row.scanned_at),
  };
}

export class RewardLedgerError extends Error {}

/** Stable, never-null dedup key: the epoch's own number when one exists,
 * or a fixed sentinel when it doesn't. See migration 0005's comment for
 * why this must never be a bare NULL. */
function epochKeyFor(epochNumber: number | null): string {
  return epochNumber === null ? "NO_EPOCH" : String(epochNumber);
}

export interface UpsertRewardLedgerEntryInput {
  walletAddress: string;
  network: WalletNetwork;
  epochNumber: number | null;
  salvAllocatedBaseUnits: bigint;
  status: RewardLedgerStatus;
  scanId: string;
}

/**
 * Inserts or updates exactly one row for (walletAddress, network, epoch)
 * — the literal "wallet + epoch = one row" requirement. Implemented as a
 * single atomic `INSERT ... ON CONFLICT ... DO UPDATE`, which Postgres
 * (and PGlite, the same engine used in tests) resolves with a per-row
 * lock: two concurrent upserts for the SAME (wallet, network, epoch) key
 * serialize safely (one applies, then the other applies on top — no lost
 * update), while upserts for DIFFERENT wallets never contend with each
 * other at all. This is a stronger, simpler guarantee than a hand-rolled
 * read-modify-write-CSV-file compare-and-swap loop would provide.
 *
 * Never computes or guesses `salvAllocatedBaseUnits`/`status` itself —
 * both must already have been derived from the authoritative reward
 * snapshot/claim system (src/lib/salv/claims.ts's `getClaimView`) by the
 * caller. This function's only job is to durably record that already-
 * computed value, exactly once per (wallet, network, epoch).
 */
export async function upsertRewardLedgerEntry(db: Db, input: UpsertRewardLedgerEntryInput): Promise<RewardLedgerEntry> {
  if (input.salvAllocatedBaseUnits < 0n) {
    throw new RewardLedgerError(`upsertRewardLedgerEntry: salvAllocatedBaseUnits must be >= 0, got ${input.salvAllocatedBaseUnits}.`);
  }
  if (!input.walletAddress.trim()) {
    throw new RewardLedgerError("upsertRewardLedgerEntry: walletAddress is required.");
  }

  const epochKey = epochKeyFor(input.epochNumber);
  const result = await db.query<RewardLedgerRow>(
    `INSERT INTO reward_ledger_entries
       (wallet_address, network, epoch_number, epoch_key, salv_allocated_base_units, status, last_scan_id, first_scanned_at, scanned_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
     ON CONFLICT (wallet_address, network, epoch_key) DO UPDATE SET
       salv_allocated_base_units = EXCLUDED.salv_allocated_base_units,
       status = EXCLUDED.status,
       last_scan_id = EXCLUDED.last_scan_id,
       scanned_at = now()
     RETURNING *`,
    [input.walletAddress, input.network, input.epochNumber, epochKey, input.salvAllocatedBaseUnits.toString(), input.status, input.scanId]
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

export async function getRewardLedgerEntry(
  db: Db,
  walletAddress: string,
  network: WalletNetwork,
  epochNumber: number | null
): Promise<RewardLedgerEntry | null> {
  const result = await db.query<RewardLedgerRow>(
    "SELECT * FROM reward_ledger_entries WHERE wallet_address = $1 AND network = $2 AND epoch_key = $3",
    [walletAddress, network, epochKeyFor(epochNumber)]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

const CSV_HEADER = "wallet_address,network,salv_allocated,epoch_id,scanned_at,status";

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
 * row per (wallet, network, epoch), most-recently-scanned first. This is
 * the ONLY place CSV text is ever produced; the table itself is the
 * durable, race-safe source of truth (see upsertRewardLedgerEntry's own
 * comment), and this function never does anything other than format
 * already-stored rows. $SALV amounts use the same deterministic,
 * bigint-based decimal string as the rest of this codebase's precision-
 * sensitive paths (src/lib/salv/tokenSpec.ts's `baseUnitsToSalvDecimalString`)
 * — never a floating-point `toFixed()`/`toLocaleString()`.
 */
export function serializeRewardLedgerToCsv(entries: RewardLedgerEntry[]): string {
  const lines = [CSV_HEADER];
  for (const entry of entries) {
    lines.push(
      [
        csvField(entry.walletAddress),
        csvField(entry.network),
        csvField(baseUnitsToSalvDecimalString(entry.salvAllocatedBaseUnits)),
        csvField(entry.epochNumber === null ? "" : String(entry.epochNumber)),
        csvField(entry.scannedAt),
        csvField(entry.status),
      ].join(",")
    );
  }
  // CSV conventionally ends with a trailing newline.
  return lines.join("\n") + "\n";
}
