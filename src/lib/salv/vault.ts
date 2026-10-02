import "server-only";
import { Db } from "../server/db/types";
import { sumClaimedBaseUnits } from "../server/repositories/rewardClaimRepo";
import { COMMUNITY_ALLOCATION_BASE_UNITS, COMMUNITY_ALLOCATION_SALV, salvToBaseUnits } from "./tokenSpec";

export class CommunityVaultError extends Error {}

export interface CommunityVaultStatus {
  /** The vault's total funding target: exactly 300,000,000 SALV, in base
   * units. This is a constant from the token spec, not a live balance
   * read — see docs/token-spec.md. */
  allocationBaseUnits: bigint;
  allocationSalv: number;
  /** Sum of every CLAIMED reward_claims row, ever. This can only grow,
   * and can never exceed allocationBaseUnits (enforced below). */
  distributedBaseUnits: bigint;
  distributedSalv: number;
  remainingBaseUnits: bigint;
  remainingSalv: number;
}

function baseUnitsToSalvNumber(amount: bigint): number {
  // Display-only conversion. Safe here because distributed/remaining are
  // always <= 300,000,000 SALV (< 2^53), unlike raw base units which can
  // exceed Number.MAX_SAFE_INTEGER -- every comparison and invariant
  // check in this module happens in bigint, never in this float.
  return Number(amount) / Number(salvToBaseUnits(1));
}

/**
 * Reads the Community Reward Vault's status purely from the
 * reward_claims ledger (the vault "must not be able to distribute more
 * than its funded balance" — Phase 5 Section 4). `distributed` only ever
 * counts claims that have actually reached CLAIMED (a real, confirmed
 * on-chain transfer out of the vault) — a CLAIMABLE-but-not-yet-claimed
 * row does not reduce the displayed remaining balance, since no SALV has
 * actually left the vault for it yet.
 *
 * Throws CommunityVaultError if distributed were ever found to exceed
 * the allocation — this should be mathematically impossible given
 * computeClaimAmountBaseUnits()'s per-snapshot floor rule, but this
 * function checks it explicitly anyway as a last line of defense rather
 * than silently reporting a negative "remaining" figure.
 */
export async function getCommunityVaultStatus(db: Db): Promise<CommunityVaultStatus> {
  const distributedBaseUnits = await sumClaimedBaseUnits(db);

  if (distributedBaseUnits > COMMUNITY_ALLOCATION_BASE_UNITS) {
    throw new CommunityVaultError(
      `Community Reward Vault invariant violated: distributed ${distributedBaseUnits} base units exceeds the ` +
        `${COMMUNITY_ALLOCATION_BASE_UNITS} base unit (${COMMUNITY_ALLOCATION_SALV} SALV) allocation. This must never ` +
        `happen -- stop all further claim processing and investigate before any more claims are paid out.`
    );
  }

  const remainingBaseUnits = COMMUNITY_ALLOCATION_BASE_UNITS - distributedBaseUnits;

  return {
    allocationBaseUnits: COMMUNITY_ALLOCATION_BASE_UNITS,
    allocationSalv: COMMUNITY_ALLOCATION_SALV,
    distributedBaseUnits,
    distributedSalv: baseUnitsToSalvNumber(distributedBaseUnits),
    remainingBaseUnits,
    remainingSalv: baseUnitsToSalvNumber(remainingBaseUnits),
  };
}
