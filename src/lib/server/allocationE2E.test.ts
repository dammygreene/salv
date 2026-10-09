import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, resetTestDb } from "./db/testDb";
import { Db } from "./db/types";
import { activateEpoch, closeEpoch, createEpoch } from "./repositories/epochRepo";
import { ensureWallet } from "./repositories/walletRepo";
import { upsertScanAllocation, getScanAllocationPoints } from "./repositories/scanAllocationRepo";
import { getWalletPointsForEpoch, listWalletPointsForEpoch } from "./repositories/pointsRepo";
import { createRewardSnapshotsForClosedEpoch } from "./createRewardSnapshots";
import { getSnapshotForWallet } from "./repositories/rewardSnapshotRepo";
import { calculateScanAllocation, DEFAULT_ALLOCATION_POLICY } from "../cull/allocationPolicy";
import { simulateWalletReward } from "../cull/rewardSimulator";
import type { Asset } from "../types";
import { calculateFixedAllocationBaseUnits } from "../cull/fixedAllocation";

function asset(id: string, classification: Asset["valueClassification"], confidence: "HIGH" | "MEDIUM" | "UNKNOWN" = "HIGH"): Asset {
  return {
    id,
    name: id,
    ticker: id,
    kind: classification?.startsWith("NFT_") ? "NFT" : classification === "EMPTY_ACCOUNT" ? "ACCOUNT" : "TOKEN",
    address: id,
    status: "REVIEW",
    age: "—",
    value: "UNKNOWN",
    valueKnown: false,
    reason: "fixture",
    action: "REVIEW",
    valueClassification: classification,
    eligibility: classification === "EMPTY_ACCOUNT" ? "ELIGIBLE" : "NOT_ELIGIBLE",
    eligibilityEvidence: {
      assetType: classification === "EMPTY_ACCOUNT" ? "EMPTY_ACCOUNT" : classification?.startsWith("NFT_") ? "NFT" : "FUNGIBLE",
      classification: classification ?? "FUNGIBLE_UNKNOWN_VALUE",
      eligibility: "ELIGIBLE",
      confidence,
      priceUsd: null,
      estimatedValueUsd: null,
      liquidityUsd: null,
      priceSource: null,
      liquiditySource: null,
      routeStatus: null,
      priceImpactBps: null,
      marketplace: null,
      floorUsd: null,
      bestListingUsd: null,
      bestOfferUsd: null,
      evidenceSources: [],
      checkedAt: null,
    },
  };
}

describe("isolated allocation flow", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => resetTestDb(db));
  afterAll(async () => db.close?.());

  it("persists the V1 policy, applies exact contributions and all caps", async () => {
    const epoch = await createEpoch(db, {
      number: 999999,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 60_000).toISOString(),
      rewardPoolPoints: 1_000_000,
      allocationPolicy: DEFAULT_ALLOCATION_POLICY,
    });
    expect(epoch.allocationPolicy).toEqual(DEFAULT_ALLOCATION_POLICY);
    await expect(
      db.query("UPDATE epochs SET allocation_policy = $1 WHERE id = $2", [JSON.stringify({ maxWalletPoints: 1 }), epoch.id])
    ).rejects.toThrow(/immutable/);

    const fixture = [
      asset("a-empty", "EMPTY_ACCOUNT", "UNKNOWN"),
      asset("b-no-liquidity", "FUNGIBLE_NO_LIQUIDITY"),
      asset("c-low-fungible", "FUNGIBLE_LOW_VALUE"),
      asset("d-valuable-fungible", "FUNGIBLE_VALUABLE"),
      asset("e-unknown-fungible", "FUNGIBLE_UNKNOWN_VALUE"),
      asset("f-no-market", "NFT_NO_MARKET"),
      asset("g-low-nft", "NFT_LOW_VALUE"),
      asset("h-valuable-nft", "NFT_VALUABLE"),
      asset("i-unknown-nft", "NFT_UNKNOWN_VALUE"),
      asset("j-review-nft", "NFT_REVIEW"),
    ];
    const result = calculateScanAllocation(fixture, epoch.allocationPolicy);
    expect(result.contributions.map((item) => [item.assetId, item.points])).toEqual([
      ["a-empty", 25],
      ["b-no-liquidity", 25],
      ["c-low-fungible", 10],
      ["e-unknown-fungible", 5],
      ["f-no-market", 20],
      ["g-low-nft", 10],
      ["i-unknown-nft", 5],
      ["j-review-nft", 5],
    ]);
    expect(result.points).toBe(105);

    for (const [classification, count] of [
      ["EMPTY_ACCOUNT", 500],
      ["FUNGIBLE_NO_LIQUIDITY", 500],
      ["NFT_LOW_VALUE", 500],
    ] as const) {
      const capped = calculateScanAllocation(
        Array.from({ length: count }, (_, index) => asset(`${classification}-${index}`, classification))
      );
      expect(capped.points).toBe(300);
      expect(capped.contributions.reduce((sum, item) => sum + item.points, 0)).toBe(300);
    }
    expect(calculateScanAllocation([
      ...Array.from({ length: 500 }, (_, index) => asset(`empty-${index}`, "EMPTY_ACCOUNT")),
      ...Array.from({ length: 500 }, (_, index) => asset(`fungible-${index}`, "FUNGIBLE_NO_LIQUIDITY")),
      ...Array.from({ length: 500 }, (_, index) => asset(`nft-${index}`, "NFT_LOW_VALUE")),
    ]).points).toBe(900);
  });

  it("makes active allocation dynamic, then freezes closed snapshots and remains idempotent", async () => {
    const epoch = await createEpoch(db, {
      number: 999999,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 60_000).toISOString(),
      rewardPoolPoints: 1_000_000,
    });
    await activateEpoch(db, epoch.id);
    const walletA = await ensureWallet(db, "11111111111111111111111111111111");
    const walletB = await ensureWallet(db, "22222222222222222222222222222222");

    await upsertScanAllocation(db, { walletId: walletA.id, epochId: epoch.id, points: 90, evidence: [] });
    expect(await getScanAllocationPoints(db, walletA.id, epoch.id)).toBe(90);
    expect(await getWalletPointsForEpoch(db, walletA.id, epoch.id)).toBe(90);
    const firstTotal = (await listWalletPointsForEpoch(db, epoch.id)).reduce((sum, row) => sum + row.points, 0);
    const firstCurrent = simulateWalletReward(90, firstTotal, epoch.rewardPoolPoints);

    await upsertScanAllocation(db, { walletId: walletA.id, epochId: epoch.id, points: 90, evidence: [] });
    expect((await db.query("SELECT COUNT(*) AS count FROM scan_allocations WHERE wallet_id = $1 AND epoch_id = $2", [walletA.id, epoch.id])).rows[0].count).toBe(1);
    await upsertScanAllocation(db, { walletId: walletB.id, epochId: epoch.id, points: 25, evidence: [] });
    const secondTotal = (await listWalletPointsForEpoch(db, epoch.id)).reduce((sum, row) => sum + row.points, 0);
    expect(secondTotal).toBe(115);
    expect(simulateWalletReward(90, secondTotal, epoch.rewardPoolPoints)).not.toBe(firstCurrent);

    await closeEpoch(db, epoch.id);
    const snapshots = await createRewardSnapshotsForClosedEpoch(db, epoch.id);
    const snapshotA = await getSnapshotForWallet(db, walletA.id, epoch.id);
    expect(snapshots).toHaveLength(2);
    expect(snapshotA?.points).toBe(90);
    expect(snapshotA?.totalPoints).toBe(115);

    await upsertScanAllocation(db, { walletId: walletB.id, epochId: epoch.id, points: 500, evidence: [] });
    await createRewardSnapshotsForClosedEpoch(db, epoch.id);
    const unchanged = await getSnapshotForWallet(db, walletA.id, epoch.id);
    expect(unchanged).toEqual(snapshotA);
  });

  it("uses the 100 CULLER rate and continues after configured budget is exceeded", async () => {
    expect(calculateFixedAllocationBaseUnits(100, 100n)).toBe(10_000n * 1_000_000_000n);
    expect(calculateFixedAllocationBaseUnits(750, 100n)).toBe(75_000n * 1_000_000_000n);
    expect(calculateFixedAllocationBaseUnits(1_000, 100n)).toBe(100_000n * 1_000_000_000n);
    expect(300_000_000n / 100_000n).toBe(3_000n);

    const epoch = await createEpoch(db, {
      number: 999998,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 60_000).toISOString(),
      rewardPoolPoints: 150_000,
      conversionRate: 100n,
    });
    await activateEpoch(db, epoch.id);
    const walletA = await ensureWallet(db, "33333333333333333333333333333333");
    const walletB = await ensureWallet(db, "44444444444444444444444444444444");
    const amount = calculateFixedAllocationBaseUnits(1_000, 100n);
    await Promise.all([
      upsertScanAllocation(db, { walletId: walletA.id, epochId: epoch.id, points: 1_000, evidence: [], cullerAllocatedBaseUnits: amount, conversionRate: 100n }),
      upsertScanAllocation(db, { walletId: walletB.id, epochId: epoch.id, points: 1_000, evidence: [], cullerAllocatedBaseUnits: amount, conversionRate: 100n }),
    ]);
    const total = await db.query<{ total: string }>("SELECT COALESCE(SUM(culler_allocated_base_units), 0) AS total FROM scan_allocations WHERE epoch_id = $1", [epoch.id]);
    expect(BigInt(total.rows[0].total)).toBe(amount * 2n);
  });
});
