export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db/client";
import { DevAuthError, assertDevAuthorized } from "@/lib/server/devAuth";
import { listRewardLedgerEntries, serializeRewardLedgerToCsv } from "@/lib/server/repositories/rewardLedgerRepo";

/**
 * GET /api/dev/culler/rewards/export — downloads the full $CULLER reward
 * allocation ledger as CSV, for manual team review.
 *
 * Gated exactly like every other dev-admin route in this codebase
 * (x-dev-admin-secret must match DEV_ADMIN_SECRET; fails closed with 403
 * if that header is missing/wrong, and fails closed if DEV_ADMIN_SECRET
 * itself is not configured on the server at all — see
 * src/lib/server/devAuth.ts). This route is never public and is
 * READ-ONLY: it has no ability to create, alter, or invent a reward --
 * it only serializes rows that upsertRewardLedgerEntry() already wrote
 * from the authoritative reward-snapshot/claim system.
 *
 * Columns, in order: solana_wallet, robinhood_wallet, epoch_id,
 * culler_allocated, scanned_at, status. One row per (Solana wallet, epoch)
 * — Solana is the sole reward identity; robinhood_wallet is an optional
 * linked address attached to that same row, left empty when none is
 * currently linked, and never a row of its own. Never includes private
 * keys, seed phrases, signatures, RPC URLs/credentials, or admin secrets
 * -- the ledger table itself has no columns for any of those, so there
 * is nothing of that shape to accidentally serialize here.
 */
export async function GET(req: NextRequest) {
  try {
    assertDevAuthorized(req);
  } catch (err) {
    if (err instanceof DevAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  let db;
  try {
    db = await getDb();
  } catch {
    return NextResponse.json({ error: "The reward database is temporarily unavailable." }, { status: 503 });
  }

  const entries = await listRewardLedgerEntries(db);
  const csv = serializeRewardLedgerToCsv(entries);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="culler-reward-ledger-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
