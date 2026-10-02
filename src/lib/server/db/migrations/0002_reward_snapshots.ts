/**
 * Migration 0002: expands reward_snapshots with the full field set a
 * real snapshot needs (epochId, wallet, points, totalPoints, rewardPool,
 * allocatedReward, createdAt) and makes the table append-only, the same
 * way points_ledger already is. Never edit 0001_init — this adds to it.
 *
 * A byte-identical copy lives at ./0002_reward_snapshots.sql for manual
 * application against a hosted Postgres provider.
 */
export const MIGRATION_0002_REWARD_SNAPSHOTS = `
ALTER TABLE reward_snapshots ADD COLUMN IF NOT EXISTS total_points bigint NOT NULL DEFAULT 0;
ALTER TABLE reward_snapshots ADD COLUMN IF NOT EXISTS reward_pool numeric NOT NULL DEFAULT 0;

-- estimated_salv was the Phase 3 working name; rename to allocatedReward's
-- column so the schema matches the Phase 4 spec's field name exactly.
ALTER TABLE reward_snapshots RENAME COLUMN estimated_salv TO allocated_reward;

-- Snapshots are a point-in-time record of a CLOSED epoch's outcome; like
-- points_ledger, once written they can never be edited or removed. A
-- correction means closing the epoch's books differently, not silently
-- rewriting history.
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
`;
