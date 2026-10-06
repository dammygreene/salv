import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ParsedTransactionWithMeta } from "@solana/web3.js";
import { Db } from "./db/types";
import { createTestDb, resetTestDb } from "./db/testDb";
import { activateEpoch, closeEpoch, createEpoch } from "./repositories/epochRepo";
import { getSnapshotForWallet, listSnapshotsForEpoch } from "./repositories/rewardSnapshotRepo";
import { createRewardSnapshotsForClosedEpoch, RewardSnapshotError } from "./createRewardSnapshots";
import { verifyAndRecordCull } from "./verifyAndRecordCull";
import { ensureWallet } from "./repositories/walletRepo";

function makeCloseTx(wallet: string, tokenAccount: string, preLamports = 2_039_280): ParsedTransactionWithMeta {
  return {
    slot: 1,
    transaction: {
      message: {
        accountKeys: [wallet, tokenAccount] as never,
        instructions: [
          {
            program: "spl-token",
            programId: {} as never,
            parsed: { type: "closeAccount", info: { account: tokenAccount, destination: wallet, owner: wallet } },
          },
        ] as never,
      },
      signatures: [],
    },
    meta: {
      err: null,
      preBalances: [5_000_000, preLamports],
      postBalances: [5_000_000 + preLamports, 0],
      innerInstructions: [],
      logMessages: [],
      fee: 5000,
    },
  } as unknown as ParsedTransactionWithMeta;
}

async function verifiedClose(db: Db, wallet: string, tokenAccount: string, signature: string) {
  const tx = makeCloseTx(wallet, tokenAccount);
  return verifyAndRecordCull(
    db,
    { wallet, signature, actions: [{ type: "CLOSE_EMPTY_TOKEN_ACCOUNT", tokenAccount, mint: null, programId: null, expectedRecoveryLamports: 2_039_280 }] },
    async () => tx
  );
}

describe("createRewardSnapshotsForClosedEpoch", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  it("refuses to snapshot an epoch that is not CLOSED", async () => {
    const epoch = await createEpoch(db, { number: 1, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 1_000_000 });
    await expect(createRewardSnapshotsForClosedEpoch(db, epoch.id)).rejects.toBeInstanceOf(RewardSnapshotError);

    await activateEpoch(db, epoch.id);
    await expect(createRewardSnapshotsForClosedEpoch(db, epoch.id)).rejects.toBeInstanceOf(RewardSnapshotError);
  });

  it("snapshots multiple wallets in exact proportion to their epoch points, with the total never exceeding the reward pool", async () => {
    const epoch = await createEpoch(db, { number: 2, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 1_000_000 });
    await activateEpoch(db, epoch.id);

    const walletA = "WalletA111111111111111111111111111111111";
    const walletB = "WalletB111111111111111111111111111111111";
    await verifiedClose(db, walletA, "TokenA1111111111111111111111111111111111", "sigA".padEnd(64, "1"));
    await verifiedClose(db, walletB, "TokenB1111111111111111111111111111111111", "sigB".padEnd(64, "1"));
    await verifiedClose(db, walletB, "TokenB2222222222222222222222222222222222", "sigB2".padEnd(64, "1")); // B earns twice as much as A

    await closeEpoch(db, epoch.id);
    const snapshots = await createRewardSnapshotsForClosedEpoch(db, epoch.id);

    expect(snapshots).toHaveLength(2);
    const byAddress = Object.fromEntries(snapshots.map((s) => [s.walletAddress, s]));
    expect(byAddress[walletA].points).toBe(100);
    expect(byAddress[walletB].points).toBe(200);
    expect(byAddress[walletA].totalPoints).toBe(300);
    expect(byAddress[walletB].totalPoints).toBe(300);
    expect(byAddress[walletA].rewardPool).toBe(1_000_000);

    // A has 1/3 of points, B has 2/3.
    expect(byAddress[walletA].allocatedReward).toBeCloseTo(333_333.33, 1);
    expect(byAddress[walletB].allocatedReward).toBeCloseTo(666_666.67, 1);

    const total = snapshots.reduce((sum, s) => sum + s.allocatedReward, 0);
    expect(total).toBeLessThanOrEqual(1_000_000);
    expect(total).toBeCloseTo(1_000_000, 4);
  });

  it("never writes a second snapshot for the same wallet/epoch pair, even if called again", async () => {
    const epoch = await createEpoch(db, { number: 3, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 500_000 });
    await activateEpoch(db, epoch.id);
    const wallet = "WalletC111111111111111111111111111111111";
    await verifiedClose(db, wallet, "TokenC1111111111111111111111111111111111", "sigC".padEnd(64, "1"));
    await closeEpoch(db, epoch.id);

    const first = await createRewardSnapshotsForClosedEpoch(db, epoch.id);
    const second = await createRewardSnapshotsForClosedEpoch(db, epoch.id);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0].id).toBe(second[0].id);

    const all = await listSnapshotsForEpoch(db, epoch.id);
    expect(all).toHaveLength(1);
  });

  it("rejects a direct attempt to insert two snapshots for the same wallet/epoch via the repository (DB constraint, not just app logic)", async () => {
    const epoch = await createEpoch(db, { number: 4, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 1000 });
    const wallet = await ensureWallet(db, "WalletD111111111111111111111111111111111");

    const { createRewardSnapshot } = await import("./repositories/rewardSnapshotRepo");
    const first = await createRewardSnapshot(db, { epochId: epoch.id, walletId: wallet.id, points: 10, totalPoints: 10, rewardPool: 1000, allocatedReward: 1000 });
    expect(first.created).toBe(true);

    const second = await createRewardSnapshot(db, { epochId: epoch.id, walletId: wallet.id, points: 10, totalPoints: 10, rewardPool: 1000, allocatedReward: 1000 });
    expect(second.created).toBe(false);
    expect(second.snapshot.id).toBe(first.snapshot.id);
  });

  it("an epoch with zero total points produces no snapshots (nothing to allocate)", async () => {
    const epoch = await createEpoch(db, { number: 5, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 1000 });
    await activateEpoch(db, epoch.id);
    await closeEpoch(db, epoch.id);

    const snapshots = await createRewardSnapshotsForClosedEpoch(db, epoch.id);
    expect(snapshots).toHaveLength(0);
  });

  it("is immutable: a direct UPDATE against an existing snapshot is refused by the database", async () => {
    const epoch = await createEpoch(db, { number: 6, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 1000 });
    const wallet = await ensureWallet(db, "WalletE111111111111111111111111111111111");
    const { createRewardSnapshot } = await import("./repositories/rewardSnapshotRepo");
    await createRewardSnapshot(db, { epochId: epoch.id, walletId: wallet.id, points: 10, totalPoints: 10, rewardPool: 1000, allocatedReward: 1000 });

    await expect(
      db.query("UPDATE reward_snapshots SET allocated_reward = 999999 WHERE wallet_id = $1", [wallet.id])
    ).rejects.toThrow(/append-only/i);
  });

  it("handles a heavily concentrated epoch (one wallet with almost all the points) without the total exceeding the pool", async () => {
    const epoch = await createEpoch(db, { number: 7, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 777_777 });
    await activateEpoch(db, epoch.id);

    const whale = "WalletWhale111111111111111111111111111111";
    for (let i = 0; i < 10; i++) {
      await verifiedClose(db, whale, `WhaleToken${i}11111111111111111111111111${i}`, `whalesig${i}`.padEnd(64, "1"));
    }
    const minnow = "WalletMinnow11111111111111111111111111111";
    await verifiedClose(db, minnow, "MinnowToken111111111111111111111111111111", "minnowsig".padEnd(64, "1"));

    await closeEpoch(db, epoch.id);
    const snapshots = await createRewardSnapshotsForClosedEpoch(db, epoch.id);
    const total = snapshots.reduce((sum, s) => sum + s.allocatedReward, 0);
    expect(total).toBeLessThanOrEqual(777_777);
    expect(total).toBeCloseTo(777_777, 4);

    const whaleSnapshot = snapshots.find((s) => s.walletAddress === whale)!;
    expect(whaleSnapshot.allocatedReward).toBeGreaterThan(700_000);
  });

  it("getSnapshotForWallet returns null before a snapshot exists and the real row afterward", async () => {
    const epoch = await createEpoch(db, { number: 8, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 1000 });
    const wallet = await ensureWallet(db, "WalletF111111111111111111111111111111111");
    expect(await getSnapshotForWallet(db, wallet.id, epoch.id)).toBeNull();

    const { createRewardSnapshot } = await import("./repositories/rewardSnapshotRepo");
    await createRewardSnapshot(db, { epochId: epoch.id, walletId: wallet.id, points: 5, totalPoints: 5, rewardPool: 1000, allocatedReward: 1000 });
    expect(await getSnapshotForWallet(db, wallet.id, epoch.id)).not.toBeNull();
  });
});
