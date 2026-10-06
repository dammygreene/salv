import { VerificationError } from "./verify";

/**
 * Client-side wrappers for the Phase 5 $CULLER claim endpoints
 * (/api/culler/vault, /api/culler/claims/:wallet[/claim]). These never
 * compute or guess a claim amount themselves — every number here comes
 * straight from the backend's immutable reward snapshot / reward_claims
 * ledger (src/lib/culler/claims.ts), and `configured`/`network` always
 * reflect the server's real deployment state so the UI can never imply
 * a live mainnet $CULLER balance while connected to Devnet.
 */

export type CullerClaimStatus = "NO_SNAPSHOT" | "CLAIMABLE" | "CLAIMED" | "FAILED";

export interface CullerClaimView {
  configured: boolean;
  network: string | null;
  wallet: string;
  epoch: number | null;
  status: CullerClaimStatus;
  amountCuller: number;
  amountBaseUnits: string;
  snapshot: { points: number; totalPoints: number; rewardPool: number; allocatedReward: number } | null;
  claim: { status: string; claimTransactionSignature: string | null; claimedAt: string | null } | null;
}

export async function fetchCullerClaimView(wallet: string, epoch?: number): Promise<CullerClaimView> {
  const query = epoch !== undefined ? `?epoch=${encodeURIComponent(epoch)}` : "";
  const response = await fetch(`/api/culler/claims/${encodeURIComponent(wallet)}${query}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new VerificationError(body?.error ?? `Could not load $CULLER claim status (${response.status}).`);
  }
  return (await response.json()) as CullerClaimView;
}

export interface CullerClaimResult {
  outcome: "CLAIMED" | "ALREADY_CLAIMED" | "NOT_CLAIMABLE" | "ZERO_AMOUNT" | "EXECUTION_FAILED";
  transactionSignature?: string | null;
  claimReceiptAddress?: string;
  amountBaseUnits?: string;
  message?: string;
}

/**
 * Executes a real on-chain claim via the backend (the backend itself
 * refuses to fake a transaction — see src/lib/solana/culler/claimExecutor.ts).
 * Throws VerificationError with the server's message on any non-2xx
 * response (including the expected, correct "ALREADY CLAIMED" case),
 * so the caller's catch block is the single place that renders it.
 */
export async function claimCuller(wallet: string, epoch: number): Promise<CullerClaimResult> {
  const response = await fetch(`/api/culler/claims/${encodeURIComponent(wallet)}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ epoch }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new VerificationError(body?.message ?? body?.error ?? `Claim request failed (${response.status}).`);
  }
  return body as CullerClaimResult;
}

export interface CullerVaultStatus {
  configured: boolean;
  network: string | null;
  mintAddress: string | null;
  treasuryAddress: string | null;
  allocationCuller: number;
  distributedCuller: number;
  remainingCuller: number;
  /** Phase 6: CLAIMABLE-but-not-yet-CLAIMED reward_claims rows — a
   * reservation against the 300M cap, not yet an on-chain transfer. */
  allocatedToRewardsCuller: number;
  /** Phase 6: permanently destroyed via a multisig-approved burn.
   * Never counted as distributed rewards. */
  burnedCuller: number;
}

export async function fetchCullerVaultStatus(): Promise<CullerVaultStatus> {
  const response = await fetch("/api/culler/vault");
  if (!response.ok) {
    throw new VerificationError(`Could not load the $CULLER vault status (${response.status}).`);
  }
  return (await response.json()) as CullerVaultStatus;
}
