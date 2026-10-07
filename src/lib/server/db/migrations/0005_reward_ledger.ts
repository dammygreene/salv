/**
 * Migration 0005: $SALV reward allocation ledger (CSV-exportable).
 *
 * `reward_ledger_entries` is the durable backing store for the
 * team-facing "reward allocation ledger" described in the no-wallet-
 * connect scan flow (see docs/salv-reward-ledger.md). It is deliberately
 * a database table, not a file on the local filesystem or an external
 * Blob store: this project already requires a real Postgres
 * `DATABASE_URL` in production (see src/lib/server/db/client.ts) and
 * already keeps its other durable, update-in-place, deduplicated ledgers
 * this way (e.g. reward_snapshots' UNIQUE(wallet_id, epoch_id)) -- this
 * is that same, already-proven pattern, not a new database or a new
 * storage technology. The actual CSV file the team downloads is
 * generated on demand (by serializing this table) via
 * GET /api/dev/salv/rewards/export -- this table itself IS the ledger;
 * "CSV" is just its export format.
 *
 * Deduplication: one row per (wallet_address, network, epoch_key) --
 * the exact "wallet + epoch = one row" identity requested. `epoch_key`
 * is a non-null text column (either the epoch's own number as text, or
 * the literal sentinel 'NO_EPOCH') specifically so Postgres's NULL-
 * distinctness rules can never defeat the uniqueness constraint when no
 * epoch exists yet -- a NULL `epoch_number` would otherwise let an
 * unbounded number of distinct rows exist for the same wallet.
 *
 * This table is update-in-place (NOT append-only, unlike
 * reward_snapshots) --
 * that is the entire point of the dedup requirement: a repeat scan for
 * the same wallet+epoch updates the existing row's `salv_allocated_base_
 * units`/`status`/`scanned_at`/`last_scan_id`, it never inserts a
 * second row. The authoritative reward calculation this row's
 * `salv_allocated_base_units` reflects always comes from
 * reward_snapshots (via getClaimView) -- this table never
 * computes or invents a reward value itself, it only records one
 * already computed elsewhere.
 *
 * A byte-identical copy lives at ./0005_reward_ledger.sql.
 */
export const MIGRATION_0005_REWARD_LEDGER = `
CREATE TABLE IF NOT EXISTS reward_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  network text NOT NULL CHECK (network IN ('solana', 'evm')),
  epoch_number int,
  epoch_key text NOT NULL,
  salv_allocated_base_units numeric NOT NULL DEFAULT 0 CHECK (salv_allocated_base_units >= 0),
  status text NOT NULL CHECK (status IN ('NOT_APPLICABLE', 'NO_EPOCH', 'NO_SNAPSHOT', 'ALLOCATED', 'CLAIMED', 'FAILED')),
  last_scan_id uuid NOT NULL,
  first_scanned_at timestamptz NOT NULL DEFAULT now(),
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_address, network, epoch_key)
);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_scanned_at ON reward_ledger_entries(scanned_at DESC);
`;
