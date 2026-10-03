import "server-only";
import { Db } from "../server/db/types";
import { sumClaimableBaseUnits, sumClaimedBaseUnits } from "../server/repositories/rewardClaimRepo";
import { sumBurnedBaseUnits } from "../server/repositories/treasuryBurnRepo";
import { COMMUNITY_ALLOCATION_BASE_UNITS, COMMUNITY_ALLOCATION_SALV, salvToBaseUnits } from "./tokenSpec";

export class CommunityVaultError extends Error {}

export interface CommunityVaultStatus {
  /** The community treasury's hard cap: exactly 300,000,000 SALV, in
   * base units. This is a constant from the token spec, not a live
   * balance read — see docs/token-spec.md. Never increased by a
   * buyback or anything else (Phase 6: "buyback is never treated as
   * newly created treasury supply"). */
  allocationBaseUnits: bigint;
  allocationSalv: number;
  /** Sum of every CLAIMED reward_claims row, ever. This can only grow,
   * and can never exceed allocationBaseUnits (enforced below). Phase 6
   * name: treasury_distributed. */
  distributedBaseUnits: bigint;
  distributedSalv: number;
  /** = allocationBaseUnits − allocatedToRewardsBaseUnits − distributedBaseUnits − burnedBaseUnits.
   * Phase 6 name: treasury_remaining — what the 300M cap still has room
   * for, accounting for amounts already promised (CLAIMABLE), already
   * sent (CLAIMED), and permanently destroyed (burned). */
  remainingBaseUnits: bigint;
  remainingSalv: number;
  /** Phase 6 addition. Sum of every CLAIMABLE (not yet CLAIMED)
   * reward_claims row — reward snapshots that have already promised an
   * amount to a wallet but where the on-chain transfer has not happened
   * yet. This is a *reservation* against the treasury's 300M cap, not a
   * distribution: a burn or any other treasury accounting must never
   * treat this as already spent, but it must still reduce `remaining`
   * (the treasury can never promise more than the cap allows). Phase 6
   * name: treasury_allocated_to_rewards. */
  allocatedToRewardsBaseUnits: bigint;
  allocatedToRewardsSalv: number;
  /** Phase 6 addition. Sum of every CONFIRMED on-chain burn recorded in
   * treasury_burns — permanent, irreversible reductions of the
   * treasury's available supply. Never counted as `distributed`
   * (burned SALV was never sent to a reward recipient) and never
   * reduces the 300M cap itself (`allocationBaseUnits` is a constant);
   * it only reduces how much of that cap remains available. Phase 6
   * name: treasury_burned. */
  burnedBaseUnits: bigint;
  burnedSalv: number;
}

function baseUnitsToSalvNumber(amount: bigint): number {
  // Display-only conversion. Safe here because every quantity in this
  // module is always <= 300,000,000 SALV (< 2^53), unlike raw base
  // units which can exceed Number.MAX_SAFE_INTEGER -- every comparison
  // and invariant check in this module happens in bigint, never in this
  // float.
  return Number(amount) / Number(salvToBaseUnits(1));
}

/**
 * Reads the $SALV community treasury's full status (Phase 6: "treasury
 * rules" — track treasury_total, treasury_allocated_to_rewards,
 * treasury_distributed, treasury_burned, treasury_remaining), computed
 * purely from three append-only ledgers (reward_claims' CLAIMABLE rows,
 * reward_claims' CLAIMED rows, and treasury_burns) — never a separately
 * mutable counter that could drift.
 *
 * Invariant enforced here, not just claimed: allocated + distributed +
 * burned must never exceed the 300,000,000 SALV cap. This should be
 * mathematically impossible given computeClaimAmountBaseUnits()'s
 * per-snapshot floor rule and the fact that nothing in this codebase can
 * record a burn without a real, already-confirmed transaction signature,
 * but this function checks it explicitly anyway as a last line of
 * defense rather than silently reporting a negative "remaining" figure.
 */
export async function getCommunityVaultStatus(db: Db): Promise<CommunityVaultStatus> {
  const [distributedBaseUnits, allocatedToRewardsBaseUnits, burnedBaseUnits] = await Promise.all([
    sumClaimedBaseUnits(db),
    sumClaimableBaseUnits(db),
    sumBurnedBaseUnits(db),
  ]);

  const committed = distributedBaseUnits + allocatedToRewardsBaseUnits + burnedBaseUnits;
  if (committed > COMMUNITY_ALLOCATION_BASE_UNITS) {
    throw new CommunityVaultError(
      `Community treasury invariant violated: distributed (${distributedBaseUnits}) + allocated-to-rewards ` +
        `(${allocatedToRewardsBaseUnits}) + burned (${burnedBaseUnits}) = ${committed} base units, which exceeds the ` +
        `${COMMUNITY_ALLOCATION_BASE_UNITS} base unit (${COMMUNITY_ALLOCATION_SALV} SALV) cap. This must never happen ` +
        `-- stop all further claim/burn processing and investigate before any more claims are paid out or burns are recorded.`
    );
  }

  const remainingBaseUnits = COMMUNITY_ALLOCATION_BASE_UNITS - committed;

  return {
    allocationBaseUnits: COMMUNITY_ALLOCATION_BASE_UNITS,
    allocationSalv: COMMUNITY_ALLOCATION_SALV,
    distributedBaseUnits,
    distributedSalv: baseUnitsToSalvNumber(distributedBaseUnits),
    remainingBaseUnits,
    remainingSalv: baseUnitsToSalvNumber(remainingBaseUnits),
    allocatedToRewardsBaseUnits,
    allocatedToRewardsSalv: baseUnitsToSalvNumber(allocatedToRewardsBaseUnits),
    burnedBaseUnits,
    burnedSalv: baseUnitsToSalvNumber(burnedBaseUnits),
  };
}

/**
 * Phase 6-preferred name for the same function, matching the "community
 * treasury" vocabulary used throughout docs/salv-treasury.md and the
 * Phase 6 spec (the underlying concept has not changed — this is the
 * Community Reward Vault from Phase 5 — so the original name and all
 * existing call sites keep working unchanged).
 */
export const getCommunityTreasuryStatus = getCommunityVaultStatus;
