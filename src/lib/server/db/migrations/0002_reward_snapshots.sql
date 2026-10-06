-- Migration 0002: expands reward_snapshots with the full field set a real
-- snapshot needs, and makes the table append-only (like points_ledger).
-- Mirror of src/lib/server/db/migrations/0002_reward_snapshots.ts (that
-- file is the one actually executed by the app).

ALTER TABLE reward_snapshots ADD COLUMN IF NOT EXISTS total_points bigint NOT NULL DEFAULT 0;
ALTER TABLE reward_snapshots ADD COLUMN IF NOT EXISTS reward_pool numeric NOT NULL DEFAULT 0;

ALTER TABLE reward_snapshots RENAME COLUMN estimated_salv TO allocated_reward;

CREATE OR REPLACE FUNCTION forbid_reward_snapshot_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'reward_snapshots is append-only';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_forbid_reward_snapshot_mutation ON reward_snapshots;
CREATE TRIGGER trg_forbid_reward_snapshot_mutation
  BEFORE UPDATE OR DELETE ON reward_snapshots
  FOR EACH ROW EXECUTE FUNCTION forbid_reward_snapshot_mutation();
