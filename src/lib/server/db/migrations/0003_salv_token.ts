/**
 * Migration 0003: $SALV token economy schema (Phase 5).
 *
 * - reward_claims: connects an immutable reward_snapshots row to an
 *   actual (Devnet, for now) $SALV claim. One claim per snapshot
 *   (UNIQUE reward_snapshot_id). Once a claim reaches CLAIMED it is
 *   fully immutable (enforced by trigger below) -- this is the
 *   database-level half of "claim once"; the on-chain claim-receipt
 *   account (see src/lib/salv/claims.ts) is the other half, so a
 *   duplicate claim is rejected even if the database were ever bypassed.
 * - fee_wallet_events: an append-only ledger of every SALVAGE Fee
 *   Wallet inflow/outflow. Balance/claimable/claimed are always derived
 *   from this ledger, never stored as a separately-mutable counter.
 *   Entirely separate from reward_claims/reward_snapshots -- protocol
 *   revenue must never be mixed with the community reward vault.
 * - buyback_dry_runs: append-only log of every dry-run buyback plan
 *   (Section 14/15). No real buyback execution exists yet; this table
 *   only ever records planned, non-executed swaps.
 * - token_deployments: an audit trail of each $SALV mint deployment
 *   (Devnet now, mainnet later) -- the authoritative runtime config is
 *   still the SALV_* environment variables (Section 16); this table
 *   just records what a deployment script actually did, for public
 *   transparency and so the app can display deployment history.
 *
 * A byte-identical copy lives at ./0003_salv_token.sql for manual
 * application against a hosted Postgres provider.
 */
export const MIGRATION_0003_SALV_TOKEN = `
CREATE TABLE IF NOT EXISTS reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_snapshot_id uuid NOT NULL REFERENCES reward_snapshots(id) UNIQUE,
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  epoch_id uuid NOT NULL REFERENCES epochs(id),
  amount_base_units numeric NOT NULL CHECK (amount_base_units >= 0),
  status text NOT NULL DEFAULT 'CLAIMABLE' CHECK (status IN ('CLAIMABLE', 'CLAIMED', 'FAILED')),
  claim_transaction_signature text,
  claim_receipt_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_reward_claims_wallet ON reward_claims(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_claims_epoch ON reward_claims(epoch_id);

-- Once CLAIMED, a reward_claims row is completely immutable -- no field
-- may change, including a second attempt to "claim" it again. This is
-- the database-level backstop for claim idempotency; see
-- src/lib/salv/claims.ts for the full claim flow and
-- docs/salv-architecture.md for the on-chain claim-receipt mechanism
-- that backstops it a second way, independent of this database.
CREATE OR REPLACE FUNCTION prevent_claimed_reward_claim_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'CLAIMED' THEN
    RAISE EXCEPTION 'reward_claims: claim % for wallet % is already CLAIMED and is immutable', OLD.id, OLD.wallet_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_claimed_reward_claim_mutation ON reward_claims;
CREATE TRIGGER trg_prevent_claimed_reward_claim_mutation
  BEFORE UPDATE ON reward_claims
  FOR EACH ROW EXECUTE FUNCTION prevent_claimed_reward_claim_mutation();

CREATE TABLE IF NOT EXISTS fee_wallet_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('IN', 'OUT')),
  asset text NOT NULL DEFAULT 'SOL',
  decimals int NOT NULL DEFAULT 9,
  amount numeric NOT NULL CHECK (amount > 0),
  source text NOT NULL,
  transaction_signature text NOT NULL UNIQUE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fee_wallet_events_created ON fee_wallet_events(created_at DESC);

CREATE OR REPLACE FUNCTION forbid_fee_wallet_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'fee_wallet_events is append-only';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_forbid_fee_wallet_event_mutation ON fee_wallet_events;
CREATE TRIGGER trg_forbid_fee_wallet_event_mutation
  BEFORE UPDATE OR DELETE ON fee_wallet_events
  FOR EACH ROW EXECUTE FUNCTION forbid_fee_wallet_event_mutation();

CREATE TABLE IF NOT EXISTS buyback_dry_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_balance numeric NOT NULL,
  fee_asset text NOT NULL DEFAULT 'SOL',
  current_salv_quote numeric NOT NULL,
  max_spend numeric NOT NULL,
  min_output numeric NOT NULL,
  slippage_limit_bps int NOT NULL,
  planned_spend numeric NOT NULL,
  expected_salv_output numeric NOT NULL,
  rejected boolean NOT NULL DEFAULT false,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_buyback_dry_runs_created ON buyback_dry_runs(created_at DESC);

CREATE OR REPLACE FUNCTION forbid_buyback_dry_run_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'buyback_dry_runs is append-only';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_forbid_buyback_dry_run_mutation ON buyback_dry_runs;
CREATE TRIGGER trg_forbid_buyback_dry_run_mutation
  BEFORE UPDATE OR DELETE ON buyback_dry_runs
  FOR EACH ROW EXECUTE FUNCTION forbid_buyback_dry_run_mutation();

CREATE TABLE IF NOT EXISTS token_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL CHECK (network IN ('devnet', 'testnet', 'mainnet-beta')),
  mint_address text NOT NULL,
  token_program text NOT NULL,
  decimals int NOT NULL,
  mint_authority text,
  freeze_authority text,
  reward_vault_address text NOT NULL,
  distributor_address text NOT NULL,
  market_holding_address text NOT NULL,
  deployed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE (network, mint_address)
);
`;
