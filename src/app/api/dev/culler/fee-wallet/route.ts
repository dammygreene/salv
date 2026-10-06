export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db/client";
import { DevAuthError, assertDevAuthorized } from "@/lib/server/devAuth";
import { FeeWalletError, getFeeWalletStatus, recordFeeReceipt, recordFeeWithdrawal } from "@/lib/culler/feeWallet";

/**
 * Dev-only CULLER FEE WALLET admin (Phase 5 Section 13). This ledger is
 * strictly protocol/creator fee revenue and is never mixed with the
 * Community Reward Vault (src/lib/culler/vault.ts / reward_claims) — there
 * is no code path anywhere that moves a balance between the two.
 *
 * GET  -> current status (balance, totalReceived, claimed, event ledger).
 * POST -> record a real observed fee event (receipt or withdrawal). This
 * does not itself talk to Solana; it logs an event an operator (or, once
 * built, an automated indexer watching the real fee wallet address)
 * observed on-chain. Gated the same way as the other dev-admin routes —
 * this is not meant for end users.
 */
export async function GET(req: NextRequest) {
  try {
    assertDevAuthorized(req);
  } catch (err) {
    if (err instanceof DevAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const asset = req.nextUrl.searchParams.get("asset") ?? "SOL";
  const db = await getDb();
  const status = await getFeeWalletStatus(db, asset);
  return NextResponse.json({ status });
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

  const { direction, asset, decimals, amount, source, transactionSignature, notes } = (body ?? {}) as {
    direction?: "IN" | "OUT";
    asset?: string;
    decimals?: number;
    amount?: number;
    source?: string;
    transactionSignature?: string;
    notes?: string;
  };

  if (direction !== "IN" && direction !== "OUT") {
    return NextResponse.json({ error: "direction must be 'IN' or 'OUT'." }, { status: 400 });
  }
  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number." }, { status: 400 });
  }
  if (!source || !transactionSignature) {
    return NextResponse.json({ error: "source and transactionSignature are required." }, { status: 400 });
  }

  const db = await getDb();
  try {
    const input = { asset, decimals, amount, source, transactionSignature, notes };
    const { event, created } = direction === "IN" ? await recordFeeReceipt(db, input) : await recordFeeWithdrawal(db, input);
    return NextResponse.json({ event, created }, { status: created ? 201 : 200 });
  } catch (err) {
    if (err instanceof FeeWalletError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
