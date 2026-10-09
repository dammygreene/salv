import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, resetTestDb } from "../db/testDb";
import { upsertRewardLedgerEntry } from "./rewardLedgerRepo";
import { getLeaderboardRank, listLeaderboard } from "./leaderboardRepo";
import type { Db } from "../db/types";

const WALLET_A = "7xK2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmP9Q";
const WALLET_B = "9aF1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBkL3x";

describe("leaderboardRepo", () => {
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

  it("aggregates verified wallet allocations across epochs and excludes zero totals", async () => {
    await upsertRewardLedgerEntry(db, { solanaWallet: WALLET_A, robinhoodWallet: null, epochNumber: 1, cullerAllocatedBaseUnits: 1_000_000_000n, status: "ALLOCATED", scanId: crypto.randomUUID() });
    await upsertRewardLedgerEntry(db, { solanaWallet: WALLET_A, robinhoodWallet: null, epochNumber: 2, cullerAllocatedBaseUnits: 1_840_120_000_000_000n, status: "ALLOCATED", scanId: crypto.randomUUID() });
    await upsertRewardLedgerEntry(db, { solanaWallet: WALLET_B, robinhoodWallet: null, epochNumber: 1, cullerAllocatedBaseUnits: 0n, status: "NO_SNAPSHOT", scanId: crypto.randomUUID() });

    const rows = await listLeaderboard(db);
    expect(rows).toEqual([{ rank: 1, walletAddress: "7xK2...mP9Q", allocation: "1840121.000000000" }]);
  });

  it("does not double-count a same-wallet same-epoch rescan", async () => {
    await upsertRewardLedgerEntry(db, { solanaWallet: WALLET_A, robinhoodWallet: null, epochNumber: 1, cullerAllocatedBaseUnits: 2_000_000_000n, status: "ALLOCATED", scanId: crypto.randomUUID() });
    await upsertRewardLedgerEntry(db, { solanaWallet: WALLET_A, robinhoodWallet: null, epochNumber: 1, cullerAllocatedBaseUnits: 3_000_000_000n, status: "ALLOCATED", scanId: crypto.randomUUID() });

    await expect(getLeaderboardRank(db, WALLET_A)).resolves.toMatchObject({ rank: 1, allocation: "3.000000000" });
  });
});
