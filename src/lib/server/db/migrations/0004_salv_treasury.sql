-- Migration 0004: $SALV community treasury accounting (Phase 6).
-- Mirror of src/lib/server/db/migrations/0004_salv_treasury.ts (that file
-- is the one actually executed by the app). Paste this directly into a
-- hosted Postgres provider SQL editor if you would rather apply it by
-- hand than let the app auto-migrate on boot.

CREATE TABLE IF NOT EXISTS treasury_burns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_base_units numeric NOT NULL CHECK (amount_base_units > 0),
  reason text NOT NULL,
  transaction_signature text NOT NULL UNIQUE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_treasury_burns_created ON treasury_burns(created_at DESC);

CREATE OR REPLACE FUNCTION forbid_treasury_burn_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'treasury_burns is append-only';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_forbid_treasury_burn_mutation ON treasury_burns;
CREATE TRIGGER trg_forbid_treasury_burn_mutation
  BEFORE UPDATE OR DELETE ON treasury_burns
  FOR EACH ROW EXECUTE FUNCTION forbid_treasury_burn_mutation();

CREATE TABLE IF NOT EXISTS treasury_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_type text NOT NULL CHECK (proposal_type IN ('FUND_REWARD_VAULT', 'BURN', 'TRANSFER')),
  amount_base_units numeric NOT NULL CHECK (amount_base_units > 0),
  destination_address text NOT NULL,
  memo text,
  unsigned_transaction_base64 text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_treasury_proposals_created ON treasury_proposals(created_at DESC);

CREATE OR REPLACE FUNCTION forbid_treasury_proposal_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'treasury_proposals is append-only -- a built proposal is never edited or deleted, only superseded by a new row';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_forbid_treasury_proposal_mutation ON treasury_proposals;
CREATE TRIGGER trg_forbid_treasury_proposal_mutation
  BEFORE UPDATE OR DELETE ON treasury_proposals
  FOR EACH ROW EXECUTE FUNCTION forbid_treasury_proposal_mutation();

ALTER TABLE token_deployments ADD COLUMN IF NOT EXISTS treasury_address text;
