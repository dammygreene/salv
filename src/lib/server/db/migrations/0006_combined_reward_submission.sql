-- Migration 0006: Solana-primary combined Solana+Robinhood reward
-- submission (Phase 8). Mirror of
-- src/lib/server/db/migrations/0006_combined_reward_submission.ts (that
-- file is the one actually executed by the app). See that file's doc
-- comment and docs/salv-reward-ledger.md for the full rationale.

DELETE FROM reward_ledger_entries WHERE network = 'evm';

ALTER TABLE reward_ledger_entries DROP CONSTRAINT IF EXISTS reward_ledger_entries_wallet_address_network_epoch_key_key;
ALTER TABLE reward_ledger_entries RENAME COLUMN wallet_address TO solana_wallet;
ALTER TABLE reward_ledger_entries DROP COLUMN IF EXISTS network;
ALTER TABLE reward_ledger_entries ADD COLUMN IF NOT EXISTS robinhood_wallet text;
ALTER TABLE reward_ledger_entries DROP CONSTRAINT IF EXISTS reward_ledger_entries_status_check;
ALTER TABLE reward_ledger_entries ADD CONSTRAINT reward_ledger_entries_status_check
  CHECK (status IN ('NO_EPOCH', 'NO_SNAPSHOT', 'ALLOCATED', 'CLAIMED', 'FAILED'));
ALTER TABLE reward_ledger_entries ADD CONSTRAINT reward_ledger_entries_solana_wallet_epoch_key_key UNIQUE (solana_wallet, epoch_key);
