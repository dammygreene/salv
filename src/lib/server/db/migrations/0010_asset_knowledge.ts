export const MIGRATION_0010_ASSET_KNOWLEDGE = `
CREATE TABLE IF NOT EXISTS asset_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL DEFAULT 'solana',
  asset_type text NOT NULL,
  asset_id text NOT NULL,
  mint_address text,
  collection_address text,
  collection_id text,
  name text,
  symbol text,
  decimals integer,
  token_program text,
  compressed boolean,
  classification text,
  eligibility text,
  confidence text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata_status text,
  provider_status text NOT NULL DEFAULT 'SUCCESS',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  next_refresh_at timestamptz,
  scan_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network, asset_type, asset_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS asset_knowledge_fungible_identity
  ON asset_knowledge (network, mint_address)
  WHERE asset_type = 'FUNGIBLE' AND mint_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS asset_knowledge_refresh_idx
  ON asset_knowledge (network, next_refresh_at);
CREATE INDEX IF NOT EXISTS asset_knowledge_collection_idx
  ON asset_knowledge (network, collection_address);
CREATE TABLE IF NOT EXISTS collection_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL DEFAULT 'solana',
  collection_address text NOT NULL,
  collection_id text,
  name text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence text,
  provider_status text NOT NULL DEFAULT 'SUCCESS',
  last_checked_at timestamptz,
  next_refresh_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network, collection_address)
);
CREATE INDEX IF NOT EXISTS collection_knowledge_refresh_idx
  ON collection_knowledge (network, next_refresh_at);
`;
