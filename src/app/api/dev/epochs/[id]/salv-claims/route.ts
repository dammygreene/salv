export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db/client";
import { DevAuthError, assertDevAuthorized } from "@/lib/server/devAuth";
import { createClaimsForEpochSnapshots } from "@/lib/salv/claims";

/**
 * Dev-only: POST /api/dev/epochs/:id/salv-claims — creates the
 * CLAIMABLE reward_claims row for every immutable snapshot already
 * written for this (closed) epoch (Phase 5 Section 5's
 * REWARD SNAPSHOT -> CLAIMABLE SALV step). Mirrors the existing
 * dev/epochs/[id]/snapshot convention. Idempotent: already-created claim
 * rows for a snapshot are left untouched, so this is safe to call more
 * than once (e.g. after snapshotting new wallets that salvaged late).
 * Still never transfers a real token — a wallet becomes CLAIMABLE here,
 * nothing on-chain happens until POST /api/salv/claims/:wallet/claim.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertDevAuthorized(req);
  } catch (err) {
    if (err instanceof DevAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const { id } = await context.params;
  const db = await getDb();
  const claims = await createClaimsForEpochSnapshots(db, id);
  return NextResponse.json({
    claims: claims.map((c) => ({
      id: c.id,
      walletId: c.walletId,
      amountBaseUnits: c.amountBaseUnits.toString(),
      status: c.status,
    })),
  });
}
