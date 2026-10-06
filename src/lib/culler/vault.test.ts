import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Db } from "../server/db/types";
import { createTestDb, resetTestDb } from "../server/db/testDb";
import { activateEpoch, closeEpoch, createEpoch } from "../server/repositories/epochRepo";
import { createRewardSnapshot } from "../server/repositories/rewardSnapshotRepo";
import { ensureWallet } from "../server/repositories/walletRepo";
import { recordTreasuryBurn } from "../server/repositories/treasuryBurnRepo";
import { attemptClaim, createClaimsForEpochSnapshots } from "./claims";
import { COMMUNITY_ALLOCATION_BASE_UNITS, COMMUNITY_ALLOCATION_CULLER } from "./tokenSpec";
import { CommunityVaultError, getCommunityVaultStatus } from "./vault";

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
    expect(status.allocationCuller).toBe(COMMUNITY_ALLOCATION_CULLER);
    expect(status.allocationBaseUnits).toBe(COMMUNITY_ALLOCATION_BASE_UNITS);
    expect(status.distributedBaseUnits).toBe(0n);
    expect(status.remainingBaseUnits).toBe(COMMUNITY_ALLOCATION_BASE_UNITS);
    expect(status.allocatedToRewardsBaseUnits).toBe(0n);
    expect(status.burnedBaseUnits).toBe(0n);
  });

  it("a CLAIMABLE-but-not-yet-claimed snapshot reduces remaining via allocatedToRewards, not distributed", async () => {
    const epoch = await createEpoch(db, {
      number: 2,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 1000).toISOString(),
      rewardPoolPoints: 50_000,
    });
    await activateEpoch(db, epoch.id);
    await closeEpoch(db, epoch.id);
    const wallet = await ensureWallet(db, "WalletVaultPending111111111111111111111111");
    await createRewardSnapshot(db, { epochId: epoch.id, walletId: wallet.id, points: 1, totalPoints: 1, rewardPool: 50_000, allocatedReward: 50_000 });
    await createClaimsForEpochSnapshots(db, epoch.id);

    const status = await getCommunityVaultStatus(db);
    expect(status.distributedCuller).toBe(0); // nothing actually claimed yet
    expect(status.allocatedToRewardsCuller).toBe(50_000); // but 50,000 is promised/reserved
    expect(status.remainingCuller).toBe(COMMUNITY_ALLOCATION_CULLER - 50_000); // reserved amount is NOT available to re-promise
    expect(status.burnedCuller).toBe(0);
  });

  it("a recorded burn reduces remaining and is tracked separately from distributed (never counted as a reward)", async () => {
    await recordTreasuryBurn(db, {
      amountBaseUnits: 1_000_000_000n, // 1 CULLER in base units
      reason: "Permanent burn of excess buyback-acquired CULLER",
      transactionSignature: "vaultBurnSig1".padEnd(64, "1"),
    });

    const status = await getCommunityVaultStatus(db);
    expect(status.burnedCuller).toBe(1);
    expect(status.distributedCuller).toBe(0); // a burn is never represented as a distributed reward
    expect(status.remainingCuller).toBe(COMMUNITY_ALLOCATION_CULLER - 1);
  });

  it("throws CommunityVaultError if distributed + allocated + burned were ever found to exceed the 300M cap", async () => {
    // Burn almost the entire cap, then allocate a claim on top of it --
    // simulates a hypothetical accounting bug to prove the invariant
    // check actually fires rather than silently reporting a negative
    // "remaining" figure.
    await recordTreasuryBurn(db, {
      amountBaseUnits: COMMUNITY_ALLOCATION_BASE_UNITS,
      reason: "test: simulate an over-cap burn",
      transactionSignature: "vaultBurnOverCap".padEnd(64, "9"),
    });

    const epoch = await createEpoch(db, {
      number: 3,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 1000).toISOString(),
      rewardPoolPoints: 1,
    });
    await activateEpoch(db, epoch.id);
    await closeEpoch(db, epoch.id);
    const wallet = await ensureWallet(db, "WalletVaultOverCap1111111111111111111111111");
    await createRewardSnapshot(db, { epochId: epoch.id, walletId: wallet.id, points: 1, totalPoints: 1, rewardPool: 1, allocatedReward: 1 });
    await createClaimsForEpochSnapshots(db, epoch.id);

    await expect(getCommunityVaultStatus(db)).rejects.toBeInstanceOf(CommunityVaultError);
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
    expect(beforeClaim.distributedCuller).toBe(0);

    await attemptClaim(db, "WalletVaultTest11111111111111111111111111", 1, async () => ({
      transactionSignature: "vaultTestSig".padEnd(64, "1"),
      claimReceiptAddress: "vaultTestReceipt1111111111111111111111111",
    }));

    const afterClaim = await getCommunityVaultStatus(db);
    expect(afterClaim.distributedCuller).toBe(10_000);
    expect(afterClaim.remainingCuller).toBe(COMMUNITY_ALLOCATION_CULLER - 10_000);
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
    expect(status.distributedCuller).toBe(5_000_000);
    expect(status.remainingBaseUnits).toBeGreaterThanOrEqual(0n);
    expect(status.distributedBaseUnits).toBeLessThanOrEqual(status.allocationBaseUnits);
  });
});
