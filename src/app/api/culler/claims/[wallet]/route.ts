export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { isValidSolanaAddress } from "@/lib/solana/base58";
import { getDb } from "@/lib/server/db/client";
import { listEpochs } from "@/lib/server/repositories/epochRepo";
import { getClaimView } from "@/lib/culler/claims";
import { getCullerConfig } from "@/lib/culler/config";
import { TOKEN_DECIMALS } from "@/lib/culler/tokenSpec";

function baseUnitsToCullerNumber(amount: bigint): number {
  // Display-only; safe up to the 300,000,000 CULLER community allocation
  // ceiling (far below Number.MAX_SAFE_INTEGER) -- see the identical
  // reasoning in src/lib/culler/vault.ts.
  return Number(amount) / 10 ** TOKEN_DECIMALS;
}

/**
 * GET /api/culler/claims/:wallet?epoch=N — this wallet's real $CULLER claim
 * standing for one epoch (Phase 5 Section 5/6): NO_SNAPSHOT, CLAIMABLE,
 * CLAIMED, or FAILED, sourced strictly from the immutable reward
 * snapshot and the reward_claims ledger — never recomputed from live,
 * possibly-changed points/epoch state. If `epoch` is omitted, this
 * defaults to the most recently CLOSED epoch (the only kind of epoch
 * that can ever have a real snapshot).
 *
 * `configured`/`network` mirror /api/culler/vault so the UI can render
 * NOT LIVE / DEVNET / CLAIMABLE / CLAIMED without ever implying a live
 * mainnet $CULLER balance while connected to Devnet (Section 17).
 */
export async function GET(req: NextRequest, context: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await context.params;
  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }

  const db = await getDb();
  const config = getCullerConfig();

  const epochParam = req.nextUrl.searchParams.get("epoch");
  let epochNumber: number | null = null;
  if (epochParam !== null) {
    epochNumber = Number(epochParam);
    if (!Number.isInteger(epochNumber)) {
      return NextResponse.json({ error: "epoch must be an integer." }, { status: 400 });
    }
  } else {
    const epochs = await listEpochs(db);
    const latestClosed = epochs.find((e) => e.status === "CLOSED");
    epochNumber = latestClosed ? latestClosed.number : null;
  }

  if (epochNumber === null) {
    return NextResponse.json({
      configured: config.configured,
      network: config.configured ? config.network : null,
      wallet,
      epoch: null,
      status: "NO_SNAPSHOT",
      amountCuller: 0,
      amountBaseUnits: "0",
      snapshot: null,
      claim: null,
    });
  }

  const view = await getClaimView(db, wallet, epochNumber);

  return NextResponse.json({
    configured: config.configured,
    network: config.configured ? config.network : null,
    wallet,
    epoch: epochNumber,
    status: view.status,
    amountCuller: baseUnitsToCullerNumber(view.amountBaseUnits),
    amountBaseUnits: view.amountBaseUnits.toString(),
    snapshot: view.snapshot
      ? {
          points: view.snapshot.points,
          totalPoints: view.snapshot.totalPoints,
          rewardPool: view.snapshot.rewardPool,
          allocatedReward: view.snapshot.allocatedReward,
        }
      : null,
    claim: view.claim
      ? {
          status: view.claim.status,
          claimTransactionSignature: view.claim.claimTransactionSignature,
          claimedAt: view.claim.claimedAt,
        }
      : null,
  });
}
