# SALVAGE - Data Model

## users
- id
- created_at
- updated_at

## wallets
- id
- user_id nullable
- chain_id
- address
- first_seen_at
- last_scanned_at
- reputation_state
- created_at

Unique: chain_id + address

## assets
- id
- chain_id
- asset_type
- contract_or_mint
- token_id nullable
- symbol nullable
- name nullable
- decimals nullable
- collection_id nullable
- first_seen_at
- metadata_uri nullable
- status

## asset_snapshots
- id
- asset_id
- wallet_id
- balance
- estimated_value nullable
- value_source nullable
- activity_score
- classification
- classification_reason
- captured_at

## scans
- id
- wallet_id
- status
- started_at
- completed_at
- provider_status
- total_assets
- salvageable_count
- watch_count
- review_count
- recoverable_value nullable

## scan_items
- id
- scan_id
- asset_id
- classification
- action_supported
- reason
- confidence

## salvage_events
- id
- wallet_id
- asset_id
- chain_id
- action_type
- tx_hash_or_signature
- instruction_index nullable
- status
- verified_at nullable
- score_awarded
- reward_epoch_id nullable
- created_at

Unique should include the immutable onchain event identity.

## reward_epochs
- id
- number
- start_at
- end_at
- reward_pool
- network_score
- status

## reward_ledger
- id
- wallet_id
- epoch_id
- salvage_event_id nullable
- score
- reward_amount
- status
- created_at

## reward_claims
- id
- wallet_id
- epoch_id
- amount
- claim_tx nullable
- status
- created_at

## watch_items
- id
- wallet_id
- asset_id
- watch_reason
- trigger_type
- trigger_config_json
- last_checked_at
- active

## risk_flags
- id
- subject_type
- subject_id
- risk_type
- severity
- evidence_json
- status
- created_at

## audit_logs
- id
- actor_type
- actor_id
- action
- metadata_json
- created_at
