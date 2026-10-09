export const MIGRATION_0013_FIXED_ALLOCATIONS = `
ALTER TABLE epochs ADD COLUMN IF NOT EXISTS culler_tokens_per_point numeric;
ALTER TABLE scan_allocations ADD COLUMN IF NOT EXISTS culler_allocated_base_units numeric NOT NULL DEFAULT 0;
ALTER TABLE scan_allocations ADD COLUMN IF NOT EXISTS conversion_rate numeric;
ALTER TABLE scan_allocations ADD COLUMN IF NOT EXISTS allocation_policy_version text NOT NULL DEFAULT 'v1';
ALTER TABLE reward_ledger_entries ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;
ALTER TABLE reward_ledger_entries ADD COLUMN IF NOT EXISTS conversion_rate numeric;
CREATE OR REPLACE FUNCTION prevent_activated_epoch_economic_update() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('ACTIVE', 'CLOSED')
     AND (NEW.culler_tokens_per_point IS DISTINCT FROM OLD.culler_tokens_per_point
       OR NEW.reward_pool_points IS DISTINCT FROM OLD.reward_pool_points) THEN
    RAISE EXCEPTION 'activated epoch economic configuration is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS epochs_activated_economic_immutable ON epochs;
CREATE TRIGGER epochs_activated_economic_immutable
  BEFORE UPDATE OF culler_tokens_per_point, reward_pool_points ON epochs
  FOR EACH ROW EXECUTE FUNCTION prevent_activated_epoch_economic_update();
`;
