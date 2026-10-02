export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db/client";
import { DevAuthError, assertDevAuthorized } from "@/lib/server/devAuth";
import { createRewardSnapshotsForClosedEpoch, RewardSnapshotError } from "@/lib/server/createRewardSnapshots";

/**
 * Dev-only: computes and writes the immutable reward snapshot for every
 * wallet that earned points in a CLOSED epoch. Simulation only — this
 * never transfers or allocates a real token. Safe to call more than
 * once; already-written snapshots are left untouched.
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
  try {
    const snapshots = await createRewardSnapshotsForClosedEpoch(db, id);
    return NextResponse.json({ snapshots });
  } catch (err) {
    if (err instanceof RewardSnapshotError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
