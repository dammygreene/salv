export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cullerToBaseUnits } from "@/lib/culler/tokenSpec";
import { getDb } from "@/lib/server/db/client";
import { DevAuthError, assertDevAuthorized } from "@/lib/server/devAuth";
import { listTreasuryBurns, recordTreasuryBurn, TreasuryBurnError } from "@/lib/server/repositories/treasuryBurnRepo";

/**
 * Dev-only $CULLER treasury burn ledger (Phase 6).
 *
 * GET  -> lists every CONFIRMED on-chain burn ever recorded (a public,
 *         read-only audit trail).
 * POST -> records a burn that ALREADY HAPPENED on-chain, authorized by
 *         the 3-of-3 treasury multisig, outside of this application.
 *         This route does not burn anything itself -- it has no
 *         signing key for the treasury and never will (Phase 6: "do
 *         NOT add an automatic burn mechanism"). `transactionSignature`
 *         must be the real signature of that already-confirmed burn.
 *
 * Gated the same way as every other dev-admin route (x-dev-admin-secret
 * matching DEV_ADMIN_SECRET; fails closed if that is unset). This gate
 * does NOT and cannot bypass the 3-of-3 multisig requirement itself --
 * it only controls who may RECORD that an already-multisig-approved
 * burn happened, which is a bookkeeping action, not a fund movement.
 */
export async function GET(req: NextRequest) {
  try {
    assertDevAuthorized(req);
  } catch (err) {
    if (err instanceof DevAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const db = await getDb();
  const burns = await listTreasuryBurns(db);
  return NextResponse.json({
    burns: burns.map((b) => ({ ...b, amountBaseUnits: b.amountBaseUnits.toString() })),
  });
}

export async function POST(req: NextRequest) {
  try {
    assertDevAuthorized(req);
  } catch (err) {
    if (err instanceof DevAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { amountCuller, reason, transactionSignature, notes } = (body ?? {}) as {
    amountCuller?: number;
    reason?: string;
    transactionSignature?: string;
    notes?: string;
  };

  if (typeof amountCuller !== "number" || amountCuller <= 0) {
    return NextResponse.json({ error: "amountCuller must be a positive number." }, { status: 400 });
  }
  if (!reason || !transactionSignature) {
    return NextResponse.json({ error: "reason and transactionSignature are required (the real, already-confirmed burn tx signature)." }, { status: 400 });
  }

  const db = await getDb();
  try {
    const { burn, created } = await recordTreasuryBurn(db, {
      amountBaseUnits: cullerToBaseUnits(amountCuller),
      reason,
      transactionSignature,
      notes,
    });
    return NextResponse.json({ burn: { ...burn, amountBaseUnits: burn.amountBaseUnits.toString() }, created }, { status: created ? 201 : 200 });
  } catch (err) {
    if (err instanceof TreasuryBurnError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
