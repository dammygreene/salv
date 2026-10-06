import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Db } from "../server/db/types";
import { createTestDb, resetTestDb } from "../server/db/testDb";
import { activateEpoch, closeEpoch, createEpoch } from "../server/repositories/epochRepo";
import { createRewardSnapshot } from "../server/repositories/rewardSnapshotRepo";
import { ensureWallet } from "../server/repositories/walletRepo";
import { attemptClaim, ClaimExecutor, createClaimsForEpochSnapshots, getClaimView, listClaimsForWalletAddress } from "./claims";
import { getCommunityVaultStatus } from "./vault";
import { BASE_UNIT_FACTOR } from "./tokenSpec";

async function setupClosedEpochWithSnapshot(
  db: Db,
  number: number,
  walletAddress: string,
  { points, totalPoints, rewardPool }: { points: number; totalPoints: number; rewardPool: number }
) {
  const epoch = await createEpoch(db, {
    number,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 1000).toISOString(),
    rewardPoolPoints: rewardPool,
  });
  await activateEpoch(db, epoch.id);
  await closeEpoch(db, epoch.id);
  const wallet = await ensureWallet(db, walletAddress);
  await createRewardSnapshot(db, {
    epochId: epoch.id,
    walletId: wallet.id,
    points,
    totalPoints,
    rewardPool,
    allocatedReward: (points / totalPoints) * rewardPool,
  });
  return { epoch, wallet };
}

function fakeExecutor(signature = "fakeSig1".padEnd(64, "1"), receipt = "fakeReceipt1111111111111111111111111111111"): ClaimExecutor {
  return vi.fn(async () => ({ transactionSignature: signature, claimReceiptAddress: receipt }));
}

describe("$CULLER claims", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  it("reports NO_SNAPSHOT before an epoch's snapshots exist", async () => {
    await createEpoch(db, { number: 1, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 1000 });
    const view = await getClaimView(db, "WalletNoSnap11111111111111111111111111111", 1);
    expect(view.status).toBe("NO_SNAPSHOT");
    expect(view.amountBaseUnits).toBe(0n);
  });

  it("createClaimsForEpochSnapshots derives the exact amount from the frozen snapshot, and attemptClaim pays it out exactly once", async () => {
    const wallet = "WalletClaim11111111111111111111111111111A";
    const { epoch } = await setupClosedEpochWithSnapshot(db, 2, wallet, { points: 1, totalPoints: 2, rewardPool: 1_000_000 });

    const claims = await createClaimsForEpochSnapshots(db, epoch.id);
    expect(claims).toHaveLength(1);
    expect(claims[0].amountBaseUnits).toBe(500_000n * BASE_UNIT_FACTOR); // exactly half of a 1M CULLER pool

    const viewBefore = await getClaimView(db, wallet, 2);
    expect(viewBefore.status).toBe("CLAIMABLE");

    const executor = fakeExecutor();
    const result = await attemptClaim(db, wallet, 2, executor);
    expect(result.outcome).toBe("CLAIMED");
    expect(executor).toHaveBeenCalledTimes(1);

    const viewAfter = await getClaimView(db, wallet, 2);
    expect(viewAfter.status).toBe("CLAIMED");
  });

  it("a second claim attempt returns ALREADY_CLAIMED and never calls the executor again", async () => {
    const wallet = "WalletClaim22222222222222222222222222222B";
    const { epoch } = await setupClosedEpochWithSnapshot(db, 3, wallet, { points: 1, totalPoints: 1, rewardPool: 1000 });
    await createClaimsForEpochSnapshots(db, epoch.id);

    const executor = fakeExecutor();
    const first = await attemptClaim(db, wallet, 3, executor);
    expect(first.outcome).toBe("CLAIMED");

    const second = await attemptClaim(db, wallet, 3, executor);
    expect(second.outcome).toBe("ALREADY_CLAIMED");
    expect(executor).toHaveBeenCalledTimes(1); // not called a second time
  });

  it("two concurrent claim attempts for the same wallet/epoch: only one succeeds", async () => {
    const wallet = "WalletClaim33333333333333333333333333333C";
    const { epoch } = await setupClosedEpochWithSnapshot(db, 4, wallet, { points: 1, totalPoints: 1, rewardPool: 1000 });
    await createClaimsForEpochSnapshots(db, epoch.id);

    const executorA = fakeExecutor("sigA".padEnd(64, "1"), "receiptA1111111111111111111111111111111111");
    const executorB = fakeExecutor("sigB".padEnd(64, "1"), "receiptB1111111111111111111111111111111111");

    const [a, b] = await Promise.all([attemptClaim(db, wallet, 4, executorA), attemptClaim(db, wallet, 4, executorB)]);
    const outcomes = [a.outcome, b.outcome].sort();
    expect(outcomes).toEqual(["ALREADY_CLAIMED", "CLAIMED"]);

    const claims = await listClaimsForWalletAddress(db, wallet);
    expect(claims).toHaveLength(1);
    expect(claims[0].status).toBe("CLAIMED");
  });

  it("a zero-point wallet never gets a snapshot, so it is reported NOT_CLAIMABLE and the executor is never called", async () => {
    const epoch = await createEpoch(db, { number: 5, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 1000 });
    await activateEpoch(db, epoch.id);
    await closeEpoch(db, epoch.id);
    // No snapshot is ever created for this wallet (mirrors
    // createRewardSnapshotsForClosedEpoch's real behavior for wallets
    // with 0 points in the epoch).
    const executor = fakeExecutor();
    const result = await attemptClaim(db, "WalletZero1111111111111111111111111111111", 5, executor);
    expect(result.outcome).toBe("NOT_CLAIMABLE");
    expect(executor).not.toHaveBeenCalled();
  });

  it("if the executor throws (on-chain transaction failed), the claim is marked FAILED and never CLAIMED, and can be retried", async () => {
    const wallet = "WalletClaimFail1111111111111111111111111D";
    const { epoch } = await setupClosedEpochWithSnapshot(db, 6, wallet, { points: 1, totalPoints: 1, rewardPool: 1000 });
    await createClaimsForEpochSnapshots(db, epoch.id);

    const failingExecutor: ClaimExecutor = vi.fn(async () => {
      throw new Error("simulated RPC failure");
    });
    const failed = await attemptClaim(db, wallet, 6, failingExecutor);
    expect(failed.outcome).toBe("EXECUTION_FAILED");

    const viewAfterFailure = await getClaimView(db, wallet, 6);
    expect(viewAfterFailure.status).toBe("FAILED");

    // A retry with a working executor re-opens the FAILED claim and
    // succeeds.
    const workingExecutor = fakeExecutor();
    const retried = await attemptClaim(db, wallet, 6, workingExecutor);
    expect(retried.outcome).toBe("CLAIMED");

    const viewAfterRetry = await getClaimView(db, wallet, 6);
    expect(viewAfterRetry.status).toBe("CLAIMED");
  });

  it("createClaimsForEpochSnapshots is idempotent: calling it twice does not duplicate claim rows", async () => {
    const wallet = "WalletClaimIdemp111111111111111111111111E";
    const { epoch } = await setupClosedEpochWithSnapshot(db, 7, wallet, { points: 1, totalPoints: 1, rewardPool: 1000 });
    const first = await createClaimsForEpochSnapshots(db, epoch.id);
    const second = await createClaimsForEpochSnapshots(db, epoch.id);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0].id).toBe(second[0].id);
  });

  it("the community vault's distributed total reflects only CLAIMED claims, and never exceeds the 300M allocation", async () => {
    const wallet = "WalletVault111111111111111111111111111111";
    const { epoch } = await setupClosedEpochWithSnapshot(db, 8, wallet, { points: 1, totalPoints: 1, rewardPool: 1000 });
    await createClaimsForEpochSnapshots(db, epoch.id);

    const beforeStatus = await getCommunityVaultStatus(db);
    expect(beforeStatus.distributedCuller).toBe(0); // claimable, not yet claimed

    await attemptClaim(db, wallet, 8, fakeExecutor());

    const afterStatus = await getCommunityVaultStatus(db);
    expect(afterStatus.distributedCuller).toBe(1000);
    expect(afterStatus.remainingCuller).toBe(afterStatus.allocationCuller - 1000);
    expect(afterStatus.distributedBaseUnits).toBeLessThanOrEqual(afterStatus.allocationBaseUnits);
  });
});
