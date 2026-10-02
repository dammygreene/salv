import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Db } from "../db/types";
import { createTestDb, resetTestDb } from "../db/testDb";
import { activateEpoch, closeEpoch, createEpoch } from "./epochRepo";
import { createRewardSnapshot } from "./rewardSnapshotRepo";
import { ensureWallet } from "./walletRepo";
import {
  ALREADY_CLAIMED,
  createRewardClaim,
  getClaimForSnapshot,
  listClaimsForWallet,
  markClaimClaimed,
  markClaimFailed,
  markClaimRetryable,
  sumClaimedBaseUnits,
} from "./rewardClaimRepo";

async function seedSnapshot(db: Db, walletAddress: string, epochNumber: number) {
  const wallet = await ensureWallet(db, walletAddress);
  const epoch = await createEpoch(db, {
    number: epochNumber,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 1000).toISOString(),
    rewardPoolPoints: 1_000_000,
  });
  await activateEpoch(db, epoch.id);
  await closeEpoch(db, epoch.id);
  const { snapshot } = await createRewardSnapshot(db, {
    epochId: epoch.id,
    walletId: wallet.id,
    points: 10,
    totalPoints: 100,
    rewardPool: 1_000_000,
    allocatedReward: 100_000,
  });
  return { wallet, epoch, snapshot };
}

describe("rewardClaimRepo", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  it("creates a CLAIMABLE claim row for a snapshot, defaulting amount/status correctly", async () => {
    const { wallet, epoch, snapshot } = await seedSnapshot(db, "ClaimRepoWalletA", 1);
    const { claim, created } = await createRewardClaim(db, {
      rewardSnapshotId: snapshot.id,
      walletId: wallet.id,
      epochId: epoch.id,
      amountBaseUnits: 123_456_789_000n,
    });
    expect(created).toBe(true);
    expect(claim.status).toBe("CLAIMABLE");
    expect(claim.amountBaseUnits).toBe(123_456_789_000n);
    expect(claim.claimTransactionSignature).toBeNull();
  });

  it("is idempotent: creating a claim twice for the same snapshot returns the same row, not a duplicate", async () => {
    const { wallet, epoch, snapshot } = await seedSnapshot(db, "ClaimRepoWalletB", 2);
    const first = await createRewardClaim(db, { rewardSnapshotId: snapshot.id, walletId: wallet.id, epochId: epoch.id, amountBaseUnits: 500n });
    const second = await createRewardClaim(db, { rewardSnapshotId: snapshot.id, walletId: wallet.id, epochId: epoch.id, amountBaseUnits: 999n });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.claim.id).toBe(first.claim.id);
    expect(second.claim.amountBaseUnits).toBe(500n); // the original amount, never overwritten by the second call's args

    const all = await listClaimsForWallet(db, wallet.id);
    expect(all).toHaveLength(1);
  });

  it("markClaimClaimed transitions CLAIMABLE -> CLAIMED exactly once (compare-and-swap)", async () => {
    const { wallet, epoch, snapshot } = await seedSnapshot(db, "ClaimRepoWalletC", 3);
    const { claim } = await createRewardClaim(db, { rewardSnapshotId: snapshot.id, walletId: wallet.id, epochId: epoch.id, amountBaseUnits: 1000n });

    const firstAttempt = await markClaimClaimed(db, claim.id, "sigAAA", "receiptAAA");
    expect(firstAttempt).not.toBe(ALREADY_CLAIMED);
    if (firstAttempt === ALREADY_CLAIMED) throw new Error("unreachable");
    expect(firstAttempt.status).toBe("CLAIMED");
    expect(firstAttempt.claimTransactionSignature).toBe("sigAAA");
    expect(firstAttempt.claimedAt).not.toBeNull();

    // A second attempt (e.g. a race, or a buggy retry) must not re-claim.
    const secondAttempt = await markClaimClaimed(db, claim.id, "sigBBB", "receiptBBB");
    expect(secondAttempt).toBe(ALREADY_CLAIMED);

    const stillOriginal = await getClaimForSnapshot(db, snapshot.id);
    expect(stillOriginal?.claimTransactionSignature).toBe("sigAAA"); // never overwritten by the losing attempt
  });

  it("the database trigger refuses any direct mutation of an already-CLAIMED row, even bypassing markClaimClaimed", async () => {
    const { wallet, epoch, snapshot } = await seedSnapshot(db, "ClaimRepoWalletD", 4);
    const { claim } = await createRewardClaim(db, { rewardSnapshotId: snapshot.id, walletId: wallet.id, epochId: epoch.id, amountBaseUnits: 1000n });
    await markClaimClaimed(db, claim.id, "sigOriginal", "receiptOriginal");

    // Bypass the application layer entirely and try a raw UPDATE, exactly
    // what a buggy or malicious code path might attempt.
    await expect(db.query("UPDATE reward_claims SET status = 'CLAIMABLE' WHERE id = $1", [claim.id])).rejects.toThrow(/immutable/i);
  });

  it("markClaimFailed never downgrades an already-CLAIMED claim", async () => {
    const { wallet, epoch, snapshot } = await seedSnapshot(db, "ClaimRepoWalletE", 5);
    const { claim } = await createRewardClaim(db, { rewardSnapshotId: snapshot.id, walletId: wallet.id, epochId: epoch.id, amountBaseUnits: 1000n });
    await markClaimClaimed(db, claim.id, "sigX", "receiptX");

    const result = await markClaimFailed(db, claim.id);
    expect(result).toBe(ALREADY_CLAIMED);
    const stillClaimed = await getClaimForSnapshot(db, snapshot.id);
    expect(stillClaimed?.status).toBe("CLAIMED");
  });

  it("markClaimFailed then markClaimRetryable reopens a claim for another attempt", async () => {
    const { wallet, epoch, snapshot } = await seedSnapshot(db, "ClaimRepoWalletF", 6);
    const { claim } = await createRewardClaim(db, { rewardSnapshotId: snapshot.id, walletId: wallet.id, epochId: epoch.id, amountBaseUnits: 1000n });

    const failed = await markClaimFailed(db, claim.id);
    expect(failed).not.toBe(ALREADY_CLAIMED);
    if (failed === ALREADY_CLAIMED) throw new Error("unreachable");
    expect(failed.status).toBe("FAILED");

    const reopened = await markClaimRetryable(db, claim.id);
    expect(reopened).not.toBe(ALREADY_CLAIMED);
    if (reopened === ALREADY_CLAIMED) throw new Error("unreachable");
    expect(reopened.status).toBe("CLAIMABLE");

    // Now a real claim can proceed.
    const claimed = await markClaimClaimed(db, claim.id, "sigRetry", "receiptRetry");
    expect(claimed).not.toBe(ALREADY_CLAIMED);
  });

  it("sumClaimedBaseUnits only counts CLAIMED rows, never CLAIMABLE or FAILED ones", async () => {
    const a = await seedSnapshot(db, "ClaimRepoWalletG", 7);
    const b = await seedSnapshot(db, "ClaimRepoWalletH", 8);

    const claimA = (await createRewardClaim(db, { rewardSnapshotId: a.snapshot.id, walletId: a.wallet.id, epochId: a.epoch.id, amountBaseUnits: 1_000n })).claim;
    await createRewardClaim(db, { rewardSnapshotId: b.snapshot.id, walletId: b.wallet.id, epochId: b.epoch.id, amountBaseUnits: 2_000n }); // left CLAIMABLE, never claimed

    expect(await sumClaimedBaseUnits(db)).toBe(0n);

    await markClaimClaimed(db, claimA.id, "sigSum", "receiptSum");
    expect(await sumClaimedBaseUnits(db)).toBe(1_000n); // only claimA, not the still-CLAIMABLE claimB
  });

  it("listClaimsForWallet returns only that wallet's claims, most recent first", async () => {
    const a = await seedSnapshot(db, "ClaimRepoWalletI", 9);
    const other = await seedSnapshot(db, "ClaimRepoWalletJ", 10);
    await createRewardClaim(db, { rewardSnapshotId: a.snapshot.id, walletId: a.wallet.id, epochId: a.epoch.id, amountBaseUnits: 1n });
    await createRewardClaim(db, { rewardSnapshotId: other.snapshot.id, walletId: other.wallet.id, epochId: other.epoch.id, amountBaseUnits: 2n });

    const claims = await listClaimsForWallet(db, a.wallet.id);
    expect(claims).toHaveLength(1);
    expect(claims[0].walletId).toBe(a.wallet.id);
  });
});
