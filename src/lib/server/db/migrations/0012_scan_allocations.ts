export const MIGRATION_0012_SCAN_ALLOCATIONS = `
ALTER TABLE epochs ADD COLUMN IF NOT EXISTS allocation_policy jsonb;
CREATE TABLE IF NOT EXISTS scan_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  epoch_id uuid NOT NULL REFERENCES epochs(id),
  points integer NOT NULL CHECK (points >= 0),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, epoch_id)
);
CREATE INDEX IF NOT EXISTS scan_allocations_epoch_idx ON scan_allocations(epoch_id);
CREATE OR REPLACE FUNCTION prevent_epoch_policy_update() RETURNS trigger AS $$
BEGIN
  IF NEW.allocation_policy IS DISTINCT FROM OLD.allocation_policy THEN
    RAISE EXCEPTION 'epoch allocation policy is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS epochs_allocation_policy_immutable ON epochs;
CREATE TRIGGER epochs_allocation_policy_immutable
  BEFORE UPDATE OF allocation_policy ON epochs
  FOR EACH ROW EXECUTE FUNCTION prevent_epoch_policy_update();
`;
