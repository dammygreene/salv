import "server-only";

/**
 * $SALV runtime configuration (Phase 5 Section 16). All of these are
 * server-only — never NEXT_PUBLIC_ — because every one of them is either
 * a secret (the distributor's signing key) or a value whose integrity
 * matters for fund safety (mint/vault/fee-wallet addresses an attacker
 * could otherwise override from a compromised client bundle).
 *
 * This module never throws just because $SALV isn't deployed yet —
 * unlike src/lib/server/db/client.ts's DATABASE_URL check, a missing
 * $SALV configuration is an expected, normal state for most of this
 * phase (no Devnet deployment has been run from this environment; see
 * docs/salv-devnet-claim-checklist.md). Callers check `configured` and
 * render "NOT LIVE" rather than the app crashing.
 */

export type SalvNetwork = "devnet" | "testnet" | "mainnet-beta";

export interface SalvConfig {
  configured: true;
  network: SalvNetwork;
  rpcUrl: string;
  mintAddress: string;
  rewardVaultAddress: string;
  distributorAddress: string;
  feeWalletAddress: string | null;
}

export interface SalvNotConfigured {
  configured: false;
  missing: string[];
}

const REQUIRED_VARS = ["SALV_MINT_ADDRESS", "SALV_REWARD_VAULT", "SALV_DISTRIBUTOR", "SOLANA_RPC_URL"] as const;

/**
 * Reads the public $SALV configuration. Returns `{ configured: false }`
 * (never throws) if any required variable is missing — most of this
 * phase runs with $SALV not yet deployed anywhere reachable from this
 * environment, and that is a normal, displayable state, not an error.
 */
export function getSalvConfig(): SalvConfig | SalvNotConfigured {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    return { configured: false, missing };
  }

  return {
    configured: true,
    network: (process.env.SALV_NETWORK?.trim() as SalvNetwork | undefined) ?? "devnet",
    rpcUrl: process.env.SOLANA_RPC_URL!.trim(),
    mintAddress: process.env.SALV_MINT_ADDRESS!.trim(),
    rewardVaultAddress: process.env.SALV_REWARD_VAULT!.trim(),
    distributorAddress: process.env.SALV_DISTRIBUTOR!.trim(),
    feeWalletAddress: process.env.SALV_FEE_WALLET?.trim() || null,
  };
}

/**
 * The distributor's own signing key, used only by the real on-chain
 * claim executor (src/lib/solana/salv/claimExecutor.ts) to authorize
 * transfers out of the Community Reward Vault. Never hard-coded, never
 * NEXT_PUBLIC_, and deliberately read by a separate function from
 * getSalvConfig() so that nothing which only needs the *public*
 * configuration (e.g. the vault-status API route) ever touches this
 * value, even in memory.
 *
 * Expected format: a JSON array of 64 numbers (the same format
 * `solana-keygen` writes), as produced by `JSON.stringify(Array.from(
 * keypair.secretKey))`. Returns null (never throws) if unset, so callers
 * can distinguish "not configured" from a malformed value (which DOES
 * throw, since a malformed secret key being silently ignored would be
 * worse than failing loudly).
 */
export function getDistributorSecretKey(): Uint8Array | null {
  const raw = process.env.SALV_DISTRIBUTOR_SECRET_KEY?.trim();
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("SALV_DISTRIBUTOR_SECRET_KEY is set but is not valid JSON (expected a JSON array of 64 numbers).");
  }
  if (!Array.isArray(parsed) || parsed.length !== 64 || !parsed.every((n) => typeof n === "number")) {
    throw new Error("SALV_DISTRIBUTOR_SECRET_KEY must be a JSON array of exactly 64 numbers (a raw Solana secret key).");
  }
  return Uint8Array.from(parsed as number[]);
}
