import "server-only";
import { Db } from "../db/types";

export type SolanaNetwork = "devnet" | "testnet" | "mainnet-beta";

export interface TokenDeploymentRecord {
  id: string;
  network: SolanaNetwork;
  mintAddress: string;
  tokenProgram: string;
  decimals: number;
  /** null means the authority has been revoked on-chain. */
  mintAuthority: string | null;
  freezeAuthority: string | null;
  rewardVaultAddress: string;
  distributorAddress: string;
  marketHoldingAddress: string;
  /** Phase 6: the community treasury's own token account address,
   * owned by the 3-of-3 multisig -- distinct from rewardVaultAddress
   * (the smaller, distributor-operated, periodically-funded operational
   * account the real claim executor spends from). Nullable only for
   * backward compatibility with Phase 5 manifests recorded before this
   * column existed; every Phase 6+ deployment must set it. */
  treasuryAddress: string | null;
  deployedAt: string;
  notes: string | null;
}

interface TokenDeploymentRow {
  id: string;
  network: SolanaNetwork;
  mint_address: string;
  token_program: string;
  decimals: number;
  mint_authority: string | null;
  freeze_authority: string | null;
  reward_vault_address: string;
  distributor_address: string;
  market_holding_address: string;
  treasury_address: string | null;
  deployed_at: string;
  notes: string | null;
}

function mapRow(row: TokenDeploymentRow): TokenDeploymentRecord {
  return {
    id: row.id,
    network: row.network,
    mintAddress: row.mint_address,
    tokenProgram: row.token_program,
    decimals: row.decimals,
    mintAuthority: row.mint_authority,
    freezeAuthority: row.freeze_authority,
    rewardVaultAddress: row.reward_vault_address,
    distributorAddress: row.distributor_address,
    marketHoldingAddress: row.market_holding_address,
    treasuryAddress: row.treasury_address,
    deployedAt: row.deployed_at,
    notes: row.notes,
  };
}

export interface RecordTokenDeploymentInput {
  network: SolanaNetwork;
  mintAddress: string;
  tokenProgram: string;
  decimals: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  rewardVaultAddress: string;
  distributorAddress: string;
  marketHoldingAddress: string;
  treasuryAddress?: string | null;
  notes?: string | null;
}

/**
 * Records a $CULLER mint deployment as a public audit trail. This is NOT
 * the app's runtime configuration source (that is the CULLER_* environment
 * variables, Section 16) — it exists so the deployment history and
 * authority state at deploy time are durably, publicly recorded even if
 * environment variables are later rotated. Never stores a private key or
 * any secret — every field here is public on-chain information.
 */
export async function recordTokenDeployment(db: Db, input: RecordTokenDeploymentInput): Promise<TokenDeploymentRecord> {
  const result = await db.query<TokenDeploymentRow>(
    `INSERT INTO token_deployments
       (network, mint_address, token_program, decimals, mint_authority, freeze_authority, reward_vault_address, distributor_address, market_holding_address, treasury_address, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (network, mint_address) DO UPDATE SET
       mint_authority = EXCLUDED.mint_authority,
       freeze_authority = EXCLUDED.freeze_authority,
       treasury_address = EXCLUDED.treasury_address,
       notes = EXCLUDED.notes
     RETURNING *`,
    [
      input.network,
      input.mintAddress,
      input.tokenProgram,
      input.decimals,
      input.mintAuthority,
      input.freezeAuthority,
      input.rewardVaultAddress,
      input.distributorAddress,
      input.marketHoldingAddress,
      input.treasuryAddress ?? null,
      input.notes ?? null,
    ]
  );
  return mapRow(result.rows[0]);
}

export async function listTokenDeployments(db: Db): Promise<TokenDeploymentRecord[]> {
  const result = await db.query<TokenDeploymentRow>("SELECT * FROM token_deployments ORDER BY deployed_at DESC");
  return result.rows.map(mapRow);
}
