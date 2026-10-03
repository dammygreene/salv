export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db/client";
import { getSalvConfig } from "@/lib/salv/config";
import { getCommunityVaultStatus } from "@/lib/salv/vault";

/**
 * GET /api/salv/vault — public, READ-ONLY community treasury status
 * (Phase 6: treasury_total / treasury_allocated_to_rewards /
 * treasury_distributed / treasury_burned / treasury_remaining). Every
 * number here is derived purely from append-only ledgers
 * (reward_claims, treasury_burns) — never a separately mutable counter
 * — and this route has no authority to move any funds; it only reads.
 *
 * `configured`/`network` tell the UI whether $SALV is actually deployed
 * anywhere reachable yet, so it can render NOT LIVE vs DEVNET rather than
 * ever implying a live mainnet balance. `treasuryAddress` is the
 * treasury's own on-chain token account (owned by the 3-of-3 multisig —
 * public information, safe to display); this route never exposes the
 * distributor's secret key, any multisig member's identity beyond their
 * already-public on-chain key, or any other server-only secret.
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
    treasuryAddress: config.configured ? config.treasuryAddress : null,
    // Phase 6 naming (treasury_total / treasury_allocated_to_rewards /
    // treasury_distributed / treasury_burned / treasury_remaining),
    // alongside the original Phase 5 field names (allocationSalv /
    // distributedSalv / remainingSalv) for backward compatibility with
    // existing consumers.
    allocationSalv: status.allocationSalv,
    allocationBaseUnits: status.allocationBaseUnits.toString(),
    distributedSalv: status.distributedSalv,
    distributedBaseUnits: status.distributedBaseUnits.toString(),
    remainingSalv: status.remainingSalv,
    remainingBaseUnits: status.remainingBaseUnits.toString(),
    allocatedToRewardsSalv: status.allocatedToRewardsSalv,
    allocatedToRewardsBaseUnits: status.allocatedToRewardsBaseUnits.toString(),
    burnedSalv: status.burnedSalv,
    burnedBaseUnits: status.burnedBaseUnits.toString(),
  });
}
