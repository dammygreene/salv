/**
 * Deterministic, integer-only reward allocator for real token base
 * units (as opposed to `src/lib/salvage/rewardSimulator.ts`, which works
 * in floating-point "points-equivalent" numbers for the UI preview and
 * never actually moves a token). This is the module that decides exactly
 * how many base units of $SALV each wallet's claim is worth once a real
 * on-chain distribution is involved — so it must never produce a
 * fractional base unit, never overshoot the pool via floating-point
 * drift, and must document where any leftover "dust" goes.
 *
 * All arithmetic is bigint. No floating point is used anywhere in this
 * module, by design — floating point cannot exactly represent most
 * base-unit-scale integers once $SALV has 9 decimals and a 1B supply
 * (amounts up to 10^18), so this module never calls Number() on a value
 * that will be compared or summed.
 *
 * Rounding rule: each wallet's allocation is
 * `floor(rewardPoolBaseUnits * walletPoints / totalValidPoints)`.
 * Flooring (never rounding up) guarantees the sum of every wallet's
 * allocation can never exceed the pool — the hard invariant this whole
 * system is built around. The unavoidable leftover from flooring many
 * wallets down ("dust") is returned separately as `dustBaseUnits`,
 * never silently folded into any one wallet's amount and never used to
 * mint additional tokens. Callers (see `src/lib/salv/vault.ts`) must
 * treat dust as "remains unallocated in the Community Reward Vault,
 * available to be carried into a future epoch's reward pool" — it is
 * never burned, never sent anywhere automatically, and never claimed by
 * any individual wallet.
 */

export interface WalletPointsInputBaseUnits {
  wallet: string;
  points: number;
}

export interface WalletAllocationBaseUnits {
  wallet: string;
  points: number;
  allocationBaseUnits: bigint;
}

export interface BaseUnitAllocationResult {
  rewardPoolBaseUnits: bigint;
  totalValidPoints: number;
  allocations: WalletAllocationBaseUnits[];
  /** Leftover base units that flooring could not assign to any wallet.
   * Always >= 0. Destination: stays in the Community Reward Vault,
   * documented in docs/token-spec.md and docs/salv-architecture.md —
   * never minted away, never silently distributed. */
  dustBaseUnits: bigint;
}

/**
 * Splits `rewardPoolBaseUnits` across `wallets` in exact proportion to
 * points, in integer base units, guaranteeing:
 *  - every wallet's allocation is a non-negative integer (bigint)
 *  - the sum of every allocation plus dustBaseUnits equals exactly
 *    rewardPoolBaseUnits whenever totalValidPoints > 0 and the pool > 0
 *  - the sum of every allocation alone can never exceed the pool
 *  - a zero-point wallet always gets exactly 0n
 *  - zero total points or a non-positive pool => everyone gets 0n and
 *    dust equals the (non-negative) pool itself
 */
export function allocateRewardBaseUnits(
  rewardPoolBaseUnits: bigint,
  wallets: WalletPointsInputBaseUnits[]
): BaseUnitAllocationResult {
  const safePool = rewardPoolBaseUnits > 0n ? rewardPoolBaseUnits : 0n;

  const normalized = wallets.map((w) => ({
    wallet: w.wallet,
    points: Number.isFinite(w.points) && w.points > 0 ? Math.trunc(w.points) : 0,
  }));
  const totalValidPoints = normalized.reduce((sum, w) => sum + w.points, 0);

  if (safePool <= 0n || totalValidPoints <= 0) {
    return {
      rewardPoolBaseUnits: safePool,
      totalValidPoints,
      allocations: normalized.map((w) => ({ wallet: w.wallet, points: w.points, allocationBaseUnits: 0n })),
      dustBaseUnits: safePool,
    };
  }

  const totalValidPointsBig = BigInt(totalValidPoints);
  let distributed = 0n;
  const allocations: WalletAllocationBaseUnits[] = normalized.map((w) => {
    const amount = w.points > 0 ? (safePool * BigInt(w.points)) / totalValidPointsBig : 0n;
    distributed += amount;
    return { wallet: w.wallet, points: w.points, allocationBaseUnits: amount };
  });

  const dustBaseUnits = safePool - distributed;

  return { rewardPoolBaseUnits: safePool, totalValidPoints, allocations, dustBaseUnits };
}
