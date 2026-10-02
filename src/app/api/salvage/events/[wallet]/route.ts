export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { isValidSolanaAddress } from "@/lib/solana/base58";
import { getDb } from "@/lib/server/db/client";
import { listVerifiedActionsForWallet } from "@/lib/server/repositories/salvageRepo";
import { ensureWallet } from "@/lib/server/repositories/walletRepo";
import { SalvageEvent } from "@/lib/types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Read-only, VERIFIED-only salvage history for one wallet, paginated.
 * No rankings, no leaderboard, no cross-wallet aggregation — just this
 * wallet's own confirmed Proof of Salvage events. */
export async function GET(req: NextRequest, context: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await context.params;
  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }

  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const offsetParam = Number(req.nextUrl.searchParams.get("offset") ?? 0);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(1, Math.trunc(limitParam)), MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(offsetParam) ? Math.max(0, Math.trunc(offsetParam)) : 0;

  const db = await getDb();
  const walletRecord = await ensureWallet(db, wallet);
  const { actions, total } = await listVerifiedActionsForWallet(db, walletRecord.id, limit, offset);

  const events: SalvageEvent[] = actions.map((action) => ({
    eventId: action.id,
    idempotencyKey: action.idempotencyKey,
    wallet,
    signature: action.signature,
    slot: 0,
    action: action.action,
    chain: "solana",
    timestamp: action.verifiedAt ?? action.createdAt,
    tokenAccount: action.tokenAccount,
    mint: action.mint,
    programId: action.programId,
    expectedRecoveryLamports: action.expectedRecoveryLamports,
    actualRecoveryLamports: action.actualRecoveryLamports,
    status: action.status,
    reason: action.reason ?? undefined,
    points: action.points,
  }));

  return NextResponse.json(
    {
      events,
      pagination: { limit, offset, total, hasMore: offset + events.length < total },
    },
    { status: 200 }
  );
}
