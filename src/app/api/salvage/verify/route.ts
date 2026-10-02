export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { isValidSolanaAddress } from "@/lib/solana/base58";
import { buildIdempotencyKey } from "@/lib/solana/idempotency";
import { fetchParsedTransactionFromChain } from "@/lib/server/rpc";
import { findEventByIdempotencyKey, recordEventIfAbsent } from "@/lib/server/salvageEventStore";
import { verifySalvageTransaction } from "@/lib/server/verifySalvageTransaction";
import { SalvageEvent } from "@/lib/types";

interface RawAction {
  type?: string;
  tokenAccount?: string;
  mint?: string | null;
  programId?: string | null;
  expectedRecoveryLamports?: number;
}

/** Deterministic, short id derived from the signature, so repeated
 * verification requests for the same signature keep producing the same
 * base id (actual uniqueness per-action comes from the idempotency key,
 * not from this id). */
function signatureHash(signature: string): string {
  let hash = 0;
  for (let i = 0; i < signature.length; i++) {
    hash = (hash * 31 + signature.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, "0").slice(0, 8);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { wallet, signature, actions } = (body ?? {}) as {
    wallet?: string;
    signature?: string;
    actions?: RawAction[];
  };

  if (!wallet || typeof wallet !== "string" || !isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }
  if (!signature || typeof signature !== "string" || signature.length < 32) {
    return NextResponse.json({ error: "Missing or invalid transaction signature." }, { status: 400 });
  }
  if (!Array.isArray(actions) || actions.length === 0) {
    return NextResponse.json({ error: "No actions submitted." }, { status: 400 });
  }

  const closeActions = actions.filter(
    (a): a is Required<Pick<RawAction, "type" | "tokenAccount">> & RawAction =>
      a.type === "CLOSE_TOKEN_ACCOUNT" &&
      typeof a.tokenAccount === "string" &&
      isValidSolanaAddress(a.tokenAccount) &&
      typeof a.expectedRecoveryLamports === "number"
  );
  if (closeActions.length !== actions.length) {
    return NextResponse.json({ error: "One or more actions are malformed or unsupported." }, { status: 400 });
  }

  const idempotencyKeys = closeActions.map((a) => buildIdempotencyKey(signature, a.type!, a.tokenAccount!));

  // Idempotency fast path: if every action in this request already has a
  // stored event, return those untouched. Never re-verify or duplicate.
  const existing = await Promise.all(idempotencyKeys.map((key) => findEventByIdempotencyKey(key)));
  if (existing.every((event): event is SalvageEvent => event !== null)) {
    return NextResponse.json({ events: existing }, { status: 200 });
  }

  const outcome = await verifySalvageTransaction(
    {
      wallet,
      signature,
      actions: closeActions.map((a) => ({
        type: "CLOSE_TOKEN_ACCOUNT",
        tokenAccount: a.tokenAccount!,
        expectedRecoveryLamports: a.expectedRecoveryLamports!,
      })),
    },
    fetchParsedTransactionFromChain
  );

  const baseId = signatureHash(signature);
  const nowIso = new Date().toISOString();

  const events: SalvageEvent[] = [];
  for (let i = 0; i < closeActions.length; i++) {
    // Skip anything already recorded individually (e.g. a partial resubmit).
    if (existing[i]) {
      events.push(existing[i]!);
      continue;
    }

    const action = closeActions[i];
    const result = outcome.results[i];
    const verified = Boolean(result?.verified);

    const event: SalvageEvent = {
      eventId: `SALV-${baseId}-${i}`,
      idempotencyKey: idempotencyKeys[i],
      wallet,
      signature,
      slot: outcome.slot ?? -1,
      action: "CLOSE_TOKEN_ACCOUNT",
      chain: "solana",
      timestamp: nowIso,
      tokenAccount: action.tokenAccount!,
      mint: action.mint ?? null,
      programId: action.programId ?? null,
      expectedRecoveryLamports: action.expectedRecoveryLamports!,
      actualRecoveryLamports: result?.actualRecoveryLamports ?? null,
      status: verified ? "VERIFIED" : "FAILED",
      reason: result?.reason ?? outcome.reason,
    };

    const { event: stored } = await recordEventIfAbsent(event);
    events.push(stored);
  }

  return NextResponse.json({ events }, { status: 200 });
}
