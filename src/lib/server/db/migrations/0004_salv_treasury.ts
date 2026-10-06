/**
 * Migration 0004: $SALV community treasury accounting (Phase 6).
 *
 * - treasury_burns: an append-only ledger of every CONFIRMED on-chain
 *   burn of $SALV from the community treasury. This table only ever
 *   records a burn that has ALREADY happened on-chain (identified by a
 *   real, unique transaction signature) -- nothing in this codebase
 *   executes a burn automatically or on a web request; see
 *   src/lib/server/repositories/treasuryBurnRepo.ts and
 *   docs/salv-treasury.md. A burn total is never counted as
 *   "distributed rewards" -- it is tracked completely separately from
 *   reward_claims, exactly like fee_wallet_events is kept separate from
 *   reward_claims in migration 0003.
 * - treasury_proposals: an append-only record of every multisig
 *   transaction/proposal this codebase has ever BUILT (constructed,
 *   unsigned) for the 3-of-3 treasury multisig to review and sign
 *   out-of-band. Recording a row here means "a proposal was built" --
 *   it never means "a transfer happened." There is no status column
 *   that could ever say EXECUTED, because this application has no way
 *   to execute one (see src/lib/solana/salv/treasuryProposals.ts).
 * - token_deployments gains a `treasury_address` column: the Phase 6
 *   role-separated deployment manifest now records a distinct treasury
 *   address (owned by the 3-of-3 multisig), separate from
 *   reward_vault_address (the smaller, distributor-operated, drawn-down
 *   account the real claim executor actually spends from).
 *
 * A byte-identical copy lives at ./0004_salv_treasury.sql.
 */
export const MIGRATION_0004_SALV_TREASURY = `
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
`;
