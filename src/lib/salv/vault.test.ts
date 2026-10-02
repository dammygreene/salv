import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Db } from "../server/db/types";
import { createTestDb, resetTestDb } from "../server/db/testDb";
import { activateEpoch, closeEpoch, createEpoch } from "../server/repositories/epochRepo";
import { createRewardSnapshot } from "../server/repositories/rewardSnapshotRepo";
import { ensureWallet } from "../server/repositories/walletRepo";
import { attemptClaim, createClaimsForEpochSnapshots } from "./claims";
import { COMMUNITY_ALLOCATION_BASE_UNITS, COMMUNITY_ALLOCATION_SALV } from "./tokenSpec";
import { getCommunityVaultStatus } from "./vault";

describe("getCommunityVaultStatus", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  it("starts fully funded and undistributed", async () => {
    const status = await getCommunityVaultStatus(db);
    expect(status.allocationSalv).toBe(COMMUNITY_ALLOCATION_SALV);
    expect(status.allocationBaseUnits).toBe(COMMUNITY_ALLOCATION_BASE_UNITS);
    expect(status.distributedBaseUnits).toBe(0n);
    expect(status.remainingBaseUnits).toBe(COMMUNITY_ALLOCATION_BASE_UNITS);
  });

  it("remaining decreases exactly by what is actually CLAIMED, never by what is merely claimable", async () => {
    const epoch = await createEpoch(db, {
      number: 1,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 1000).toISOString(),
      rewardPoolPoints: 10_000,
    });
    await activateEpoch(db, epoch.id);
    await closeEpoch(db, epoch.id);
    const wallet = await ensureWallet(db, "WalletVaultTest11111111111111111111111111");
    await createRewardSnapshot(db, { epochId: epoch.id, walletId: wallet.id, points: 1, totalPoints: 1, rewardPool: 10_000, allocatedReward: 10_000 });
    await createClaimsForEpochSnapshots(db, epoch.id);

    const beforeClaim = await getCommunityVaultStatus(db);
    expect(beforeClaim.distributedSalv).toBe(0);

    await attemptClaim(db, "WalletVaultTest11111111111111111111111111", 1, async () => ({
      transactionSignature: "vaultTestSig".padEnd(64, "1"),
      claimReceiptAddress: "vaultTestReceipt1111111111111111111111111",
    }));

    const afterClaim = await getCommunityVaultStatus(db);
    expect(afterClaim.distributedSalv).toBe(10_000);
    expect(afterClaim.remainingSalv).toBe(COMMUNITY_ALLOCATION_SALV - 10_000);
  });

  it("never reports a negative remaining balance even under many sequential claims", async () => {
    for (let i = 0; i < 5; i++) {
      const epoch = await createEpoch(db, {
        number: 100 + i,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 1000).toISOString(),
        rewardPoolPoints: 1_000_000,
      });
      await activateEpoch(db, epoch.id);
      await closeEpoch(db, epoch.id);
      const address = `WalletMulti${i}11111111111111111111111111111`;
      const wallet = await ensureWallet(db, address);
      await createRewardSnapshot(db, { epochId: epoch.id, walletId: wallet.id, points: 1, totalPoints: 1, rewardPool: 1_000_000, allocatedReward: 1_000_000 });
      await createClaimsForEpochSnapshots(db, epoch.id);
      await attemptClaim(db, address, 100 + i, async () => ({
        transactionSignature: `multiSig${i}`.padEnd(64, "1"),
        claimReceiptAddress: `multiReceipt${i}1111111111111111111111111`,
      }));
    }

    const status = await getCommunityVaultStatus(db);
    expect(status.distributedSalv).toBe(5_000_000);
    expect(status.remainingBaseUnits).toBeGreaterThanOrEqual(0n);
    expect(status.distributedBaseUnits).toBeLessThanOrEqual(status.allocationBaseUnits);
  });
});
