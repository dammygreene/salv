/**
 * Migration 0006: Solana-primary combined Solana+Robinhood reward
 * submission (Phase 8).
 *
 * Phase 7's `reward_ledger_entries` treated `network` (solana vs evm) as
 * part of a row's own identity, which allowed a standalone EVM-only
 * row -- exactly the "Robinhood only" submission the product now
 * explicitly forbids. Phase 8 makes the **Solana wallet the sole reward
 * identity**: every row now represents ONE combined submission (a
 * required Solana wallet plus an optional linked Robinhood/EVM wallet),
 * never two separate rows for the same scan, and never two independent
 * reward allocations for one submission. See docs/salv-reward-ledger.md
 * for the full product model and replacement-policy rationale.
 *
 * This project has not launched and holds no real financial data at
 * this phase, so this migration cleans up the superseded shape directly
 * rather than preserving it behind a compatibility shim:
 *
 *  1. Any existing standalone EVM-only row (`network = 'evm'`) is
 *     deleted -- it represents a submission shape the product no longer
 *     allows to exist at all. (A Solana row that also happens to have no
 *     linked Robinhood wallet is untouched; only pure-EVM rows go.)
 *  2. `wallet_address` (always a Solana address for the surviving rows)
 *     is renamed to `solana_wallet`, naming it for what it now always is.
 *  3. The `network` column is dropped -- a row's identity is simply
 *     "this Solana wallet, this epoch" now; there is no network
 *     dimension to a row's identity anymore.
 *  4. A new nullable `robinhood_wallet` column holds the optional linked
 *     address. It is metadata about the submission, never part of the
 *     row's identity and never independently unique. Replacement policy
 *     (documented in `rewardLedgerRepo.ts` and
 *     `docs/salv-reward-ledger.md`): every upsert sets this column to
 *     exactly what that scan submitted (a new value, or `NULL` if this
 *     scan didn't include one) -- the ledger always reflects the most
 *     recently submitted state for this Solana wallet + epoch, never an
 *     additive merge of every Robinhood address ever seen.
 *  5. The unique identity becomes `(solana_wallet, epoch_key)`.
 *  6. The status enum drops `NOT_APPLICABLE` (it only ever meant "this
 *     row's network isn't Solana," which can no longer happen -- every
 *     row's reward status now always flows from its Solana wallet's own
 *     claim view).
 *
 * A byte-identical copy lives at ./0006_combined_reward_submission.sql.
 */
export const MIGRATION_0006_COMBINED_REWARD_SUBMISSION = `
DELETE FROM reward_ledger_entries WHERE network = 'evm';

ALTER TABLE reward_ledger_entries DROP CONSTRAINT IF EXISTS reward_ledger_entries_wallet_address_network_epoch_key_key;
ALTER TABLE reward_ledger_entries RENAME COLUMN wallet_address TO solana_wallet;
ALTER TABLE reward_ledger_entries DROP COLUMN IF EXISTS network;
ALTER TABLE reward_ledger_entries ADD COLUMN IF NOT EXISTS robinhood_wallet text;
ALTER TABLE reward_ledger_entries DROP CONSTRAINT IF EXISTS reward_ledger_entries_status_check;
ALTER TABLE reward_ledger_entries ADD CONSTRAINT reward_ledger_entries_status_check
  CHECK (status IN ('NO_EPOCH', 'NO_SNAPSHOT', 'ALLOCATED', 'CLAIMED', 'FAILED'));
ALTER TABLE reward_ledger_entries ADD CONSTRAINT reward_ledger_entries_solana_wallet_epoch_key_key UNIQUE (solana_wallet, epoch_key);
`;
