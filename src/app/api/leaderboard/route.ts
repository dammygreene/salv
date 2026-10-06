import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db/client";
import { getLeaderboardRank, listLeaderboard } from "@/lib/server/repositories/leaderboardRepo";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 100), 1), 100);
    const offset = Math.max(Number(req.nextUrl.searchParams.get("offset") ?? 0), 0);
    const db = await getDb();
    const rows = await listLeaderboard(db, limit, offset);
    const wallet = req.cookies.get("culler_wallet")?.value;
    const currentUser = wallet ? await getLeaderboardRank(db, wallet) : null;
    return NextResponse.json({ rows, currentUser });
  } catch (error) {
    console.error("Leaderboard query failed", error);
    return NextResponse.json({ error: "Leaderboard unavailable right now." }, { status: 503 });
  }
}
