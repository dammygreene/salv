export const MIGRATION_0011_ASSET_KNOWLEDGE_COVERAGE = `
ALTER TABLE asset_knowledge
  ADD COLUMN IF NOT EXISTS coverage_status text NOT NULL DEFAULT 'CHECKED',
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;
CREATE INDEX IF NOT EXISTS asset_knowledge_coverage_idx
  ON asset_knowledge (network, coverage_status, next_retry_at);
`;
