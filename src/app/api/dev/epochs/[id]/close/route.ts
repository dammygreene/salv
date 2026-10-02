export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db/client";
import { DevAuthError, assertDevAuthorized } from "@/lib/server/devAuth";
import { closeEpoch, EpochError } from "@/lib/server/repositories/epochRepo";

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
    const epoch = await closeEpoch(db, id);
    return NextResponse.json({ epoch });
  } catch (err) {
    if (err instanceof EpochError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
