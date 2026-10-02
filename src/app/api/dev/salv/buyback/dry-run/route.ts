export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db/client";
import { DevAuthError, assertDevAuthorized } from "@/lib/server/devAuth";
import { BuybackPolicy, BuybackPolicyError, planAndRecordBuyback } from "@/lib/salv/buyback";
import { listBuybackDryRuns } from "@/lib/server/repositories/buybackDryRunRepo";

/**
 * Dev-only buyback dry-run (Phase 5 Sections 14-15). POST plans (and
 * durably records, for transparency) a hypothetical buyback — it never
 * executes a real swap, never touches a live Solana connection, and
 * never holds a private key (see src/lib/salv/buyback.ts's module
 * comment). Both `policy` and `input` must be supplied explicitly in the
 * request body; there is no default policy baked in anywhere, which is
 * the literal enforcement of "must require an explicit configured
 * policy before execution."
 *
 * GET lists the most recent recorded dry runs (append-only, so this is
 * also the audit trail of every plan ever considered, rejected or not).
 */
export async function GET(req: NextRequest) {
  try {
    assertDevAuthorized(req);
  } catch (err) {
    if (err instanceof DevAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
  const db = await getDb();
  const dryRuns = await listBuybackDryRuns(db);
  return NextResponse.json({ dryRuns });
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

  const { policy, input } = (body ?? {}) as { policy?: BuybackPolicy; input?: Parameters<typeof planAndRecordBuyback>[2] };
  if (!policy || !input) {
    return NextResponse.json({ error: "Both 'policy' and 'input' are required in the request body." }, { status: 400 });
  }

  const db = await getDb();
  try {
    const record = await planAndRecordBuyback(db, policy, input);
    return NextResponse.json({ dryRun: record });
  } catch (err) {
    if (err instanceof BuybackPolicyError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
