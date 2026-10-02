export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { isValidSolanaAddress } from "@/lib/solana/base58";
import { listEventsForWallet } from "@/lib/server/salvageEventStore";

/** Read-only salvage history for one wallet. No rankings, no leaderboard,
 * no cross-wallet aggregation — just this wallet's own verified events. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "Invalid or missing wallet query parameter." }, { status: 400 });
  }

  const events = await listEventsForWallet(wallet);
  return NextResponse.json({ events }, { status: 200 });
}
