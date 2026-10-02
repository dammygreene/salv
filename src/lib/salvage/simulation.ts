/**
 * EST. SALV simulation — purely illustrative, no real token exists yet.
 * Models a simple proportional-share buyback/distribution: if a fixed
 * pool of $SALV were split across every point awarded in an epoch, what
 * would this wallet's share look like right now? As more wallets
 * participate and earn points in the same epoch, `epochTotalPoints`
 * grows and every existing participant's estimate dilutes accordingly —
 * which is exactly the dynamic this simulation exists to let us test
 * ("what happens if 10,000 people participate?") before any real token
 * is in circulation.
 */
export const SIMULATED_EPOCH_SALV_ALLOCATION = 1_000_000;

export function simulateEstimatedSalv(walletEpochPoints: number, epochTotalPoints: number): number {
  if (epochTotalPoints <= 0 || walletEpochPoints <= 0) return 0;
  return (walletEpochPoints / epochTotalPoints) * SIMULATED_EPOCH_SALV_ALLOCATION;
}
