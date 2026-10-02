export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { isValidSolanaAddress } from "@/lib/solana/base58";
import { getDb } from "@/lib/server/db/client";
import { getActiveEpoch, getEpochTotalPointsAwarded } from "@/lib/server/repositories/epochRepo";
import { getWalletPointsForEpoch, getWalletStats } from "@/lib/server/repositories/pointsRepo";
import { ensureWallet } from "@/lib/server/repositories/walletRepo";
import { simulateWalletReward } from "@/lib/salvage/rewardSimulator";

/**
 * GET /api/rewards/:wallet — this wallet's lifetime verified stats plus
 * its standing in the currently ACTIVE epoch (if any). `estimatedReward`
 * is always a simulation (lib/salvage/rewardSimulator.ts), proportional
 * to the epoch's own configured `rewardPoolPoints` — never a real $SALV
 * balance, and nothing here ever moves or allocates a real token.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await context.params;
  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }

  const db = await getDb();
  const walletRecord = await ensureWallet(db, wallet);
  const stats = await getWalletStats(db, walletRecord.id);
  const activeEpoch = await getActiveEpoch(db);

  let epochPoints = 0;
  let networkPoints = 0;
  let rewardPool = 0;
  let estimatedReward = 0;
  if (activeEpoch) {
    epochPoints = await getWalletPointsForEpoch(db, walletRecord.id, activeEpoch.id);
    networkPoints = await getEpochTotalPointsAwarded(db, activeEpoch.id);
    rewardPool = activeEpoch.rewardPoolPoints;
    estimatedReward = simulateWalletReward(epochPoints, networkPoints, rewardPool);
  }

  return NextResponse.json({
    wallet,
    points: stats.points,
    verifiedEvents: stats.verifiedEvents,
    assetsSalvaged: stats.assetsSalvaged,
    actualRecovery: stats.actualRecoveryLamports / 1_000_000_000,
    actualRecoveryLamports: stats.actualRecoveryLamports,
    currentEpoch: activeEpoch
      ? { number: activeEpoch.number, startsAt: activeEpoch.startsAt, endsAt: activeEpoch.endsAt, status: activeEpoch.status }
      : null,
    epochPoints,
    networkPoints,
    rewardPool,
    estimatedReward,
  });
}
