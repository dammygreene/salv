-- Migration 0005: $SALV reward allocation ledger (CSV-exportable).
-- Mirror of src/lib/server/db/migrations/0005_reward_ledger.ts (that file
-- is the one actually executed by the app). Paste this directly into a
-- hosted Postgres provider's SQL editor if you'd rather apply it by hand.
-- See docs/salv-reward-ledger.md for the full design rationale.

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
