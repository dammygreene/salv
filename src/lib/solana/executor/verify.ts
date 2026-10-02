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
        type: "CLOSE_TOKEN_ACCOUNT",
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

export async function fetchSalvageHistory(wallet: string): Promise<SalvageEvent[]> {
  const response = await fetch(`/api/salvage/events?wallet=${encodeURIComponent(wallet)}`);
  if (!response.ok) {
    throw new VerificationError(`Could not load salvage history (${response.status}).`);
  }
  const body = (await response.json()) as VerifyResponse;
  return body.events;
}
