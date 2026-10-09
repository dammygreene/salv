import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Db } from "../db/types";
import { createTestDb, resetTestDb } from "../db/testDb";
import { activateEpoch, closeEpoch, createEpoch, EpochError, getActiveEpoch, getEpochByNumber, listEpochs } from "./epochRepo";

describe("epochRepo", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  beforeEach(async () => {
    await resetTestDb(db);
  });

  afterAll(async () => {
    await db.close?.();
  });

  it("creates an epoch as UPCOMING and it is not yet the active epoch", async () => {
    const epoch = await createEpoch(db, {
      number: 1,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 1000).toISOString(),
      rewardPoolPoints: 1000,
    });

    expect(epoch.status).toBe("UPCOMING");
    expect(await getActiveEpoch(db)).toBeNull();
    expect(await getEpochByNumber(db, 1)).toMatchObject({ id: epoch.id });
  });

  function epochPolicy() {
    return {
      perAssetCap: 100,
      maxWalletPoints: 1000,
      categoryCaps: { EMPTY_ACCOUNT: 300, FUNGIBLE: 300, NFT: 300 },
      emptyAccountPoints: 25,
      fungibleNoLiquidityPoints: 25,
      fungibleLowValuePoints: 10,
      fungibleUnknownPoints: 5,
      nftNoMarketPoints: 20,
      nftLowValuePoints: 10,
      nftUnknownPoints: 5,
      nftReviewPoints: 5,
      minimumConfidence: "MEDIUM" as const,
    };
  }

  it("snapshots the allocation policy and rejects database mutation", async () => {
    const epoch = await createEpoch(db, {
      number: 99,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 1000).toISOString(),
      rewardPoolPoints: 1000,
      allocationPolicy: { ...epochPolicy(), maxWalletPoints: 777 },
    });

    expect(epoch.allocationPolicy.maxWalletPoints).toBe(777);
    await expect(
      db.query("UPDATE epochs SET allocation_policy = $1 WHERE id = $2", [JSON.stringify({ maxWalletPoints: 1 }), epoch.id])
    ).rejects.toThrow(/immutable/);
  });

  it("preserves the fixed conversion rate and budget after activation", async () => {
    const epoch = await createEpoch(db, {
      number: 100,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 1000).toISOString(),
      rewardPoolPoints: 300_000_000,
      conversionRate: 100n,
    });
    await activateEpoch(db, epoch.id);
    expect((await getEpochByNumber(db, 100))?.conversionRate).toBe(100n);
    await expect(
      db.query("UPDATE epochs SET culler_tokens_per_point = $1 WHERE id = $2", ["1000", epoch.id])
    ).rejects.toThrow(/economic configuration is immutable/);
    await expect(
      db.query("UPDATE epochs SET reward_pool_points = $1 WHERE id = $2", ["1", epoch.id])
    ).rejects.toThrow(/economic configuration is immutable/);
  });

  it("activating an epoch makes it ACTIVE and closes whatever was previously active", async () => {
    const e1 = await createEpoch(db, { number: 1, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 1000 });
    const e2 = await createEpoch(db, { number: 2, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 1000 });

    await activateEpoch(db, e1.id);
    expect((await getActiveEpoch(db))?.id).toBe(e1.id);

    await activateEpoch(db, e2.id);
    const active = await getActiveEpoch(db);
    expect(active?.id).toBe(e2.id);

    const all = await listEpochs(db);
    const e1After = all.find((e) => e.id === e1.id);
    expect(e1After?.status).toBe("CLOSED");
  });

  it("refuses to activate an epoch that is not UPCOMING (e.g. already CLOSED)", async () => {
    const e1 = await createEpoch(db, { number: 1, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 1000 });
    await activateEpoch(db, e1.id);
    await closeEpoch(db, e1.id);
    await expect(activateEpoch(db, e1.id)).rejects.toBeInstanceOf(EpochError);
  });

  it("the database itself enforces at most one ACTIVE epoch at a time (partial unique index), not just application logic", async () => {
    const e1 = await createEpoch(db, { number: 1, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 1000 });
    const e2 = await createEpoch(db, { number: 2, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 1000 });
    await activateEpoch(db, e1.id);

    // Bypass the repository's own transactional close-then-activate and
    // try to force two ACTIVE rows directly — the database constraint
    // itself must still refuse this.
    await expect(db.query("UPDATE epochs SET status = 'ACTIVE' WHERE id = $1", [e2.id])).rejects.toThrow();
  });

  it("refuses to close an epoch that is not currently ACTIVE", async () => {
    const e1 = await createEpoch(db, { number: 1, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 1000).toISOString(), rewardPoolPoints: 1000 });
    await expect(closeEpoch(db, e1.id)).rejects.toBeInstanceOf(EpochError);
  });
});
