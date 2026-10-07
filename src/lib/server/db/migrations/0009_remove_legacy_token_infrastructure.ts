/** Remove tables used only by the retired app-controlled token system. */
export const MIGRATION_0009_REMOVE_LEGACY_TOKEN_INFRASTRUCTURE = `
DROP TABLE IF EXISTS treasury_proposals;
DROP TABLE IF EXISTS treasury_burns;
DROP TABLE IF EXISTS buyback_dry_runs;
DROP TABLE IF EXISTS fee_wallet_events;
DROP TABLE IF EXISTS token_deployments;
DROP TABLE IF EXISTS reward_claims;
`;
