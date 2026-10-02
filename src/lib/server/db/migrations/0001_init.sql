-- Migration 0001: Proof of Salvage + points ledger + epochs schema.
-- Mirror of src/lib/server/db/migrations/0001_init.ts (that file is the
-- one actually executed by the app). Paste this directly into a hosted
-- Postgres provider's SQL editor (Supabase, Neon, etc.) if you'd rather
-- apply it by hand than let the app auto-migrate on boot.

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  chain text NOT NULL DEFAULT 'solana',
  address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, address)
);

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text NOT NULL DEFAULT 'solana',
  mint text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('TOKEN', 'NFT')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, mint)
);

CREATE TABLE IF NOT EXISTS asset_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id),
  classification text NOT NULL CHECK (classification IN (
    'EMPTY_TOKEN_ACCOUNT', 'KNOWN_SPAM_TOKEN', 'KNOWN_SPAM_NFT',
    'UNKNOWN_TOKEN', 'ACTIVE_TOKEN', 'POTENTIALLY_REDEEMABLE_NFT'
  )),
  source text NOT NULL DEFAULT 'scanner',
  confidence numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_classifications_asset ON asset_classifications(asset_id, created_at DESC);

CREATE TABLE IF NOT EXISTS epochs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number int NOT NULL UNIQUE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reward_pool_points bigint NOT NULL,
  status text NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ACTIVE', 'CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Only one epoch may ever be ACTIVE at a time, enforced by the database
-- itself (a partial unique index), not merely by application logic.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_epoch ON epochs (status) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS salvage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  chain text NOT NULL DEFAULT 'solana',
  transaction_signature text NOT NULL,
  slot bigint,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'FAILED', 'REVERSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  UNIQUE (chain, transaction_signature)
);

CREATE TABLE IF NOT EXISTS salvage_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salvage_event_id uuid NOT NULL REFERENCES salvage_events(id),
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  asset_id uuid REFERENCES assets(id),
  token_account text NOT NULL,
  program_id text,
  mint text,
  classification text,
  action text NOT NULL CHECK (action IN ('CLOSE_EMPTY_TOKEN_ACCOUNT', 'BURN_VERIFIED_TOKEN', 'BURN_VERIFIED_NFT')),
  idempotency_key text NOT NULL UNIQUE,
  expected_recovery_lamports bigint NOT NULL DEFAULT 0,
  actual_recovery_lamports bigint,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'FAILED', 'REVERSED')),
  reason text,
  points int NOT NULL DEFAULT 0,
  points_awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  -- Core anti-farming primitive: once THIS wallet has recorded an action
  -- against THIS token account, it can never do so again under any new
  -- transaction signature. Closes the "close, reopen, close again"
  -- infinite points loop at the database level, not just in app code.
  UNIQUE (wallet_id, token_account, action)
);
CREATE INDEX IF NOT EXISTS idx_salvage_actions_wallet ON salvage_actions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_salvage_actions_mint ON salvage_actions(mint, action);

-- A VERIFIED action's identity and outcome are immutable. The only
-- allowed status transition afterwards is an explicit move to REVERSED.
CREATE OR REPLACE FUNCTION prevent_verified_action_mutation() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'VERIFIED' THEN
    IF NEW.status NOT IN ('VERIFIED', 'REVERSED') THEN
      RAISE EXCEPTION 'salvage_actions: cannot change a VERIFIED action to % (only REVERSED is allowed)', NEW.status;
    END IF;
    IF NEW.idempotency_key <> OLD.idempotency_key
      OR NEW.token_account <> OLD.token_account
      OR NEW.action <> OLD.action
      OR NEW.wallet_id <> OLD.wallet_id
      OR NEW.actual_recovery_lamports IS DISTINCT FROM OLD.actual_recovery_lamports
      OR NEW.points <> OLD.points THEN
      RAISE EXCEPTION 'salvage_actions: cannot change the identity or outcome of a VERIFIED action';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_verified_action_mutation ON salvage_actions;
CREATE TRIGGER trg_prevent_verified_action_mutation
  BEFORE UPDATE ON salvage_actions
  FOR EACH ROW EXECUTE FUNCTION prevent_verified_action_mutation();

CREATE TABLE IF NOT EXISTS points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  salvage_action_id uuid NOT NULL REFERENCES salvage_actions(id) UNIQUE,
  epoch_id uuid REFERENCES epochs(id),
  points int NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_points_ledger_wallet ON points_ledger(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_ledger_epoch ON points_ledger(epoch_id);

-- Append-only: a points entry can never be edited or removed once
-- written. Corrections must be new, separately reasoned entries.
CREATE OR REPLACE FUNCTION forbid_points_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'points_ledger is append-only';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_forbid_points_ledger_mutation ON points_ledger;
CREATE TRIGGER trg_forbid_points_ledger_mutation
  BEFORE UPDATE OR DELETE ON points_ledger
  FOR EACH ROW EXECUTE FUNCTION forbid_points_ledger_mutation();

CREATE TABLE IF NOT EXISTS reward_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  epoch_id uuid NOT NULL REFERENCES epochs(id),
  points int NOT NULL,
  estimated_salv numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, epoch_id)
);
