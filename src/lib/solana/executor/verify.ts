import { SalvageEvent } from "@/lib/types";
import { RunSalvageResult } from "./runSalvage";

export class VerificationError extends Error {}

export interface VerifyResponse {
  events: SalvageEvent[];
}

/**
 * Calls the backend verification endpoint, which independently
 * re-derives truth from chain (it does not trust anything claimed here
 * beyond "please check this signature"). This is the ONLY path that can
 * ever produce a VERIFIED SalvageEvent — nothing on the client is allowed
 * to mark a salvage as confirmed. Safe to call again after a page
 * refresh: the backend is idempotent on (signature, action).
 */
export async function submitForVerification(result: RunSalvageResult): Promise<VerifyResponse> {
  const response = await fetch("/api/salvage/verify", {
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

/** Verified-only, paginated salvage history for one wallet. */
export async function fetchSalvageHistory(
  wallet: string,
  options: { limit?: number; offset?: number } = {}
): Promise<PaginatedVerifyResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));
  const query = params.toString();
  const response = await fetch(`/api/salvage/events/${encodeURIComponent(wallet)}${query ? `?${query}` : ""}`);
  if (!response.ok) {
    throw new VerificationError(`Could not load salvage history (${response.status}).`);
  }
  return (await response.json()) as PaginatedVerifyResponse;
}

export interface RewardsSummary {
  wallet: string;
  points: number;
  verifiedEvents: number;
  assetsSalvaged: number;
  actualRecovery: number;
  actualRecoveryLamports: number;
  currentEpoch: { number: number; startsAt: string; endsAt: string; status: string } | null;
  epochPoints: number;
  estimatedReward: number;
}

/** This wallet's lifetime verified stats + current-epoch standing.
 * `estimatedReward` is always a simulation — see lib/salvage/simulation.ts. */
export async function fetchRewardsSummary(wallet: string): Promise<RewardsSummary> {
  const response = await fetch(`/api/rewards/${encodeURIComponent(wallet)}`);
  if (!response.ok) {
    throw new VerificationError(`Could not load rewards summary (${response.status}).`);
  }
  return (await response.json()) as RewardsSummary;
}
