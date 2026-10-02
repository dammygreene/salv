export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db/client";
import { getSalvConfig } from "@/lib/salv/config";
import { getCommunityVaultStatus } from "@/lib/salv/vault";

/**
 * GET /api/salv/vault — public, read-only Community Reward Vault status
 * (Phase 5 Section 4): the fixed 300,000,000 SALV allocation, how much
 * has actually been distributed (sum of CLAIMED claims only — a real,
 * confirmed on-chain transfer, never an estimate), and how much remains.
 *
 * `configured`/`network` tell the UI whether $SALV is actually deployed
 * anywhere reachable yet, so it can render NOT LIVE vs DEVNET rather than
 * ever implying a live mainnet balance. This endpoint never exposes the
 * distributor's secret key or any other server-only secret — only
 * public addresses, taken from src/lib/salv/config.ts's getSalvConfig().
 */
export async function GET() {
  const db = await getDb();
  const status = await getCommunityVaultStatus(db);
  const config = getSalvConfig();

  return NextResponse.json({
    configured: config.configured,
    network: config.configured ? config.network : null,
    mintAddress: config.configured ? config.mintAddress : null,
    rewardVaultAddress: config.configured ? config.rewardVaultAddress : null,
    allocationSalv: status.allocationSalv,
    allocationBaseUnits: status.allocationBaseUnits.toString(),
    distributedSalv: status.distributedSalv,
    distributedBaseUnits: status.distributedBaseUnits.toString(),
    remainingSalv: status.remainingSalv,
    remainingBaseUnits: status.remainingBaseUnits.toString(),
  });
}
