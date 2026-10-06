import { CullEvent } from "@/lib/types";
import { RunCullResult } from "./runCull";

export class VerificationError extends Error {}

export interface VerifyResponse {
  events: CullEvent[];
}

/**
 * Calls the backend verification endpoint, which independently
 * re-derives truth from chain (it does not trust anything claimed here
 * beyond "please check this signature"). This is the ONLY path that can
 * ever produce a VERIFIED CullEvent — nothing on the client is allowed
 * to mark a cull as confirmed. Safe to call again after a page
 * refresh: the backend is idempotent on (signature, action).
 */
export async function submitForVerification(result: RunCullResult): Promise<VerifyResponse> {
  const response = await fetch("/api/cull/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet: result.wallet,
      signature: result.signature,
      actions: result.actions.map((action) => ({
        type: "CLOSE_EMPTY_TOKEN_ACCOUNT",
        tokenAccount: action.tokenAccount,
        mint: action.mint,
        programId: action.programId,
        expectedRecoveryLamports: action.expectedRecoveryLamports,
      })),
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new VerificationError(body?.error ?? `Verification request failed (${response.status}).`);
  }

  return (await response.json()) as VerifyResponse;
}

export interface PaginatedVerifyResponse extends VerifyResponse {
  pagination: { limit: number; offset: number; total: number; hasMore: boolean };
}

/** Verified-only, paginated cull history for one wallet. */
export async function fetchCullHistory(
  wallet: string,
  options: { limit?: number; offset?: number } = {}
): Promise<PaginatedVerifyResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));
  const query = params.toString();
  const response = await fetch(`/api/cull/events/${encodeURIComponent(wallet)}${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw new VerificationError(`Could not load cull history (${response.status}).`);
  }
  return (await response.json()) as PaginatedVerifyResponse;
}

export interface RewardsSummary {
  wallet: string;
  points: number;
  verifiedEvents: number;
  assetsCulld: number;
  actualRecovery: number;
  actualRecoveryLamports: number;
  currentEpoch: { number: number; startsAt: string; endsAt: string; status: string } | null;
  epochPoints: number;
  /** Sum of every wallet's points in the current epoch so far. */
  networkPoints: number;
  /** The current epoch's configured simulated reward pool. */
  rewardPool: number;
  estimatedReward: number;
}

/** This wallet's lifetime verified stats + current-epoch standing.
 * `estimatedReward` is always a simulation — see lib/cull/rewardSimulator.ts. */
export async function fetchRewardsSummary(wallet: string): Promise<RewardsSummary> {
  const response = await fetch(`/api/rewards/${encodeURIComponent(wallet)}`);
  if (!response.ok) {
    throw new VerificationError(`Could not load rewards summary (${response.status}).`);
  }
  return (await response.json()) as RewardsSummary;
}

