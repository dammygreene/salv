import { beforeAll, beforeEach, describe, expect, it } from "vitest";
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
