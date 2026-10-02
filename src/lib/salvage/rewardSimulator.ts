/**
 * Pure, deterministic reward-pool simulator. No I/O, no randomness, no
 * wall-clock reads — same inputs always produce the same output. This is
 * the single formula used both by the live "simulated reward" shown on
 * the rewards page (against the currently ACTIVE epoch's running totals)
 * and by the real, immutable reward snapshot created once an epoch
 * CLOSES (see repositories/rewardSnapshotRepo.ts) and by the economic
 * stress simulations (see scripts/economic-simulations.ts). All three
 * must agree, which is only guaranteed if they all call this.
 *
 * Formula: walletPoints / totalValidPoints * rewardPool
 *
 * "totalValidPoints" only ever sums points >= 0 (a defensive floor;
 * points are never negative in practice since the ledger is append-only
 * and every entry comes from calculateSalvagePoints(), but a simulation
 * tool must not silently misbehave if fed malformed input).
 */

export interface WalletPointsInput {
  wallet: string;
  points: number;
}

export interface WalletRewardAllocation {
  wallet: string;
  points: number;
  /** This wallet's share of totalValidPoints, in [0, 1]. Always 0 when
   * totalValidPoints is 0 or this wallet's points are 0. */
  share: number;
  /** This wallet's slice of rewardPool. Always 0 when totalValidPoints
   * or this wallet's points are 0. The sum of every allocation's
   * estimatedReward across the whole input is guaranteed to equal
   * rewardPool exactly whenever totalValidPoints > 0 and rewardPool > 0
   * (see the floating-point remainder note below), and 0 otherwise — it
   * can never exceed rewardPool. */
  estimatedReward: number;
}

export interface RewardSimulationResult {
  rewardPool: number;
  totalValidPoints: number;
  allocations: WalletRewardAllocation[];
}

/**
 * Simulates splitting `rewardPool` across `wallets` in exact proportion
 * to each wallet's points.
 *
 * Handles:
 *  - zero total points (everyone gets 0; the pool is not distributed —
 *    there is nothing valid to proportion it against)
 *  - a zero-point wallet mixed in with others (that wallet always gets
 *    exactly 0, never a stray floating-point crumb)
 *  - a non-positive rewardPool (every allocation is 0)
 *  - negative/garbage point values (floored to 0 defensively)
 *
 * Floating-point note: naively computing `points[i] / total * rewardPool`
 * independently for every wallet and summing the results can overshoot
 * or undershoot `rewardPool` by a tiny epsilon due to IEEE754 rounding.
 * To guarantee the sum never exceeds the pool (a hard invariant for this
 * system), every wallet except the one with the most points is given its
 * literal proportional share, and the largest-points wallet (ties broken
 * by ascending wallet address, for determinism) absorbs the leftover
 * remainder (`rewardPool - sum(everyone else)`) instead of its own raw
 * share. Because every other wallet's reward is independently computed
 * and never touched afterwards, a 0-point wallet's reward is always
 * exactly `0 * rewardPool = 0`, never a rounding artifact.
 */
export function simulateEpochRewards(rewardPool: number, wallets: WalletPointsInput[]): RewardSimulationResult {
  const safeRewardPool = Number.isFinite(rewardPool) && rewardPool > 0 ? rewardPool : 0;

  const normalized = wallets.map((w) => ({ wallet: w.wallet, points: Number.isFinite(w.points) && w.points > 0 ? w.points : 0 }));
  const totalValidPoints = normalized.reduce((sum, w) => sum + w.points, 0);

  if (safeRewardPool <= 0 || totalValidPoints <= 0) {
    return {
      rewardPool: safeRewardPool,
      totalValidPoints,
      allocations: normalized.map((w) => ({ wallet: w.wallet, points: w.points, share: 0, estimatedReward: 0 })),
    };
  }

  // Deterministic tie-break: most points first; equal points sorted by
  // wallet address ascending. The first entry after sorting is the one
  // that absorbs the floating-point remainder.
  const order = [...normalized].sort((a, b) => (b.points !== a.points ? b.points - a.points : a.wallet.localeCompare(b.wallet)));
  const remainderWallet = order[0]?.wallet;

  let sumOfOthers = 0;
  const rewardByWallet = new Map<string, number>();
  for (const w of order) {
    if (w.wallet === remainderWallet) continue; // computed last, below
    const share = w.points / totalValidPoints;
    const reward = share * safeRewardPool;
    rewardByWallet.set(w.wallet, reward);
    sumOfOthers += reward;
  }
  if (remainderWallet !== undefined) {
    rewardByWallet.set(remainderWallet, safeRewardPool - sumOfOthers);
  }

  const allocations: WalletRewardAllocation[] = normalized.map((w) => ({
    wallet: w.wallet,
    points: w.points,
    share: w.points / totalValidPoints,
    estimatedReward: rewardByWallet.get(w.wallet) ?? 0,
  }));

  return { rewardPool: safeRewardPool, totalValidPoints, allocations };
}

/** Convenience for previewing a single wallet's share without knowing
 * every other wallet's points (e.g. the live rewards page, which only
 * ever has this wallet's points plus the epoch-wide total on hand). This
 * is a live, non-final *preview* — it intentionally skips the
 * remainder-absorption trick in simulateEpochRewards() (that only
 * matters when allocating the literal full pool across every wallet at
 * once, e.g. for a real closed-epoch snapshot) and uses the plain
 * proportional formula directly. */
export function simulateWalletReward(walletPoints: number, totalValidPoints: number, rewardPool: number): number {
  const safePool = Number.isFinite(rewardPool) && rewardPool > 0 ? rewardPool : 0;
  const safePoints = Number.isFinite(walletPoints) && walletPoints > 0 ? walletPoints : 0;
  if (totalValidPoints <= 0 || safePoints <= 0 || safePool <= 0) return 0;
  return (safePoints / totalValidPoints) * safePool;
}

